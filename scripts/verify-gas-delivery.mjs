#!/usr/bin/env node
/**
 * Verify LI.FI destination gas delivery for a completed Nova Swap.
 *
 * Usage:
 *   node scripts/verify-gas-delivery.mjs <sourceTxHash>
 *   LIFI_API_KEY=... node scripts/verify-gas-delivery.mjs <sourceTxHash>   (optional, avoids rate limits)
 *
 * Read-only: it only queries LI.FI's public status API and the destination chain's public RPC.
 * It prints the evidence needed to mark a route as "gas delivery verified":
 *   source tx, destination tx(s), swap output, native gas received, destination balance before/after.
 */

const LIFI = 'https://li.quest/v1';
const txHash = process.argv[2];
if (!txHash) {
  console.error('Usage: node scripts/verify-gas-delivery.mjs <sourceTxHash>');
  process.exit(1);
}
const headers = process.env.LIFI_API_KEY ? { 'x-lifi-api-key': process.env.LIFI_API_KEY } : {};

const getJson = async (url, init) => {
  const res = await fetch(url, { ...init, headers: { ...headers, ...(init?.headers || {}) } });
  const body = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, body };
};
const units = (raw, decimals) => (raw == null ? null : Number(BigInt(raw)) / 10 ** decimals);

const rpcCall = async (rpc, method, params) => {
  const res = await fetch(rpc, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const j = await res.json();
  if (j.error) throw new Error(j.error.message);
  return j.result;
};

const main = async () => {
  const report = { sourceTxHash: txHash };

  // 1. Swap status
  const status = await getJson(`${LIFI}/status?txHash=${encodeURIComponent(txHash)}`);
  if (!status.ok) {
    console.log(JSON.stringify({ ...report, error: `LI.FI status ${status.status}: ${status.body?.message ?? ''}` }, null, 2));
    return;
  }
  const s = status.body;
  report.swapStatus = `${s.status}${s.substatus ? ` / ${s.substatus}` : ''}`;
  report.tool = s.tool;
  report.sourceChainId = s.sending?.chainId;
  report.destinationChainId = s.receiving?.chainId;
  report.receiver = s.toAddress;
  report.destinationSwapTx = s.receiving?.txHash ?? null;
  report.swapOutput = s.receiving?.amount
    ? `${units(s.receiving.amount, s.receiving.token.decimals)} ${s.receiving.token.symbol}`
    : null;
  report.feeCostsUSD = (s.feeCosts || []).map((f) => `${f.name}: $${f.amountUSD}`);

  // 2. Gas status (LI.Fuel / Gas.zip)
  const gas = await getJson(`${LIFI}/gas/status?txHash=${encodeURIComponent(txHash)}`);
  report.gasStatusHttp = gas.status;
  report.gasStatus = gas.body?.status ?? null;
  const gr = gas.body?.receiving;
  report.gasDeliveryTx = gr?.txHash ?? null;
  report.gasReceivedReported = gr?.amount ? `${units(gr.amount, gr.token.decimals)} ${gr.token.symbol}` : null;
  report.gasCostReported = gas.body?.sending?.amount
    ? `${units(gas.body.sending.amount, gas.body.sending.token.decimals)} ${gas.body.sending.token.symbol}`
    : null;

  // 3. On-chain check on the destination (EVM only)
  const chains = (await getJson(`${LIFI}/chains?chainTypes=EVM,SVM,UTXO,MVM,TVM`)).body?.chains || [];
  const dest = chains.find((c) => c.id === report.destinationChainId);
  report.destinationChain = dest?.name ?? report.destinationChainId;
  report.nativeToken = dest?.nativeToken?.symbol;
  if (dest?.chainType === 'EVM' && report.receiver) {
    const rpc = dest.metadata?.rpcUrls?.[0];
    const dec = dest.nativeToken?.decimals ?? 18;
    try {
      report.currentNativeBalance = units(await rpcCall(rpc, 'eth_getBalance', [report.receiver, 'latest']), dec);
      if (report.gasDeliveryTx) {
        const tx = await rpcCall(rpc, 'eth_getTransactionByHash', [report.gasDeliveryTx]);
        const receipt = await rpcCall(rpc, 'eth_getTransactionReceipt', [report.gasDeliveryTx]);
        report.gasTxRecipient = tx?.to;
        report.gasTxValue = tx ? units(tx.value, dec) : null;
        report.gasTxSucceeded = receipt?.status === '0x1';
        const block = BigInt(receipt.blockNumber);
        try {
          const before = units(await rpcCall(rpc, 'eth_getBalance', [report.receiver, '0x' + (block - 1n).toString(16)]), dec);
          const after = units(await rpcCall(rpc, 'eth_getBalance', [report.receiver, '0x' + block.toString(16)]), dec);
          report.balanceBefore = before;
          report.balanceAfter = after;
          report.balanceChange = after - before;
        } catch (e) {
          report.balanceHistory = `RPC has no history for that block (${e.message}); record the balance manually before the next test`;
        }
      }
    } catch (e) {
      report.rpcError = e.message;
    }
  } else if (dest) {
    report.onChainCheck = `Not automated for ${dest.chainType}; check the receiver balance in a ${dest.name} explorer`;
  }

  report.verdict =
    report.gasStatus === 'DONE' && (report.gasTxSucceeded !== false) && (report.balanceChange == null || report.balanceChange > 0)
      ? 'GAS DELIVERED (confirm amounts above)'
      : 'NOT VERIFIED';
  console.log(JSON.stringify(report, null, 2));
};

main().catch((e) => {
  console.error('Verification failed:', e.message);
  process.exit(1);
});
