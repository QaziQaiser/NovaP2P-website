// Futures trading actions (signed by the Nova trading key, so no wallet popup per trade).
import { HL_MARKET_SLIPPAGE, HL_TRIGGER_SLIPPAGE } from '../../../config/hyperliquid';
import { agentExchange, orderBuilder, toOrderPrice, toOrderSize } from './hlClient';
import type { PerpMarket, PerpOpenOrder, PerpPosition } from './useHyperliquid';

type OrderLeg = {
  a: number;
  b: boolean;
  p: string;
  s: string;
  r: boolean;
  t: { limit: { tif: 'Ioc' } } | { trigger: { isMarket: true; triggerPx: string; tpsl: 'tp' | 'sl' } };
};

function exchangeFor(user: string) {
  const ex = agentExchange(user);
  if (!ex) throw new Error('Trading is not enabled in this browser yet. Please click "Enable Trading".');
  return ex;
}

/** Worst acceptable price for a market order in the given direction. */
const marketPx = (refPx: number, isBuy: boolean, slippage: number, szDecimals: number) =>
  toOrderPrice(refPx * (isBuy ? 1 + slippage : 1 - slippage), szDecimals);

/** A reduce-only TP or SL that closes the position with a market order once `triggerPx` is hit. */
function triggerLeg(market: PerpMarket, closeIsBuy: boolean, size: string, triggerPx: number, tpsl: 'tp' | 'sl'): OrderLeg {
  return {
    a: market.index,
    b: closeIsBuy,
    p: marketPx(triggerPx, closeIsBuy, HL_TRIGGER_SLIPPAGE, market.szDecimals),
    s: size,
    r: true,
    t: { trigger: { isMarket: true, triggerPx: toOrderPrice(triggerPx, market.szDecimals), tpsl } },
  };
}

export interface CoinLeverage {
  value: number;
  type: 'cross' | 'isolated';
}

/** Sets leverage and margin mode for the coin when they differ from the user's current setting. */
export async function ensureLeverage(
  user: string,
  market: PerpMarket,
  leverage: number,
  isCross: boolean,
  current: CoinLeverage | null
): Promise<void> {
  if (current && current.value === leverage && (current.type === 'cross') === isCross) return;
  await exchangeFor(user).updateLeverage({ asset: market.index, isCross, leverage });
}

export interface MarketOrderResult {
  filledSize: number;
  avgPx: number;
}

/** Opens or adds to a position with a market order, optionally with TP and SL attached. */
export async function placeMarketOrder(params: {
  user: string;
  market: PerpMarket;
  isBuy: boolean;
  size: string;
  leverage: number;
  isCross: boolean;
  currentLeverage: CoinLeverage | null;
  takeProfit?: number;
  stopLoss?: number;
  builderApproved: boolean;
}): Promise<MarketOrderResult> {
  const { user, market, isBuy, size, takeProfit, stopLoss } = params;
  await ensureLeverage(user, market, params.leverage, params.isCross, params.currentLeverage);

  const ref = market.midPx || market.markPx;
  const orders: OrderLeg[] = [
    { a: market.index, b: isBuy, p: marketPx(ref, isBuy, HL_MARKET_SLIPPAGE, market.szDecimals), s: size, r: false, t: { limit: { tif: 'Ioc' } } },
  ];
  if (takeProfit) orders.push(triggerLeg(market, !isBuy, size, takeProfit, 'tp'));
  if (stopLoss) orders.push(triggerLeg(market, !isBuy, size, stopLoss, 'sl'));

  const res = await exchangeFor(user).order({
    orders,
    grouping: orders.length > 1 ? 'normalTpsl' : 'na',
    ...orderBuilder(params.builderApproved),
  });
  const first: any = res.response.data.statuses[0];
  if (first?.filled) return { filledSize: Number(first.filled.totalSz), avgPx: Number(first.filled.avgPx) };
  return { filledSize: 0, avgPx: 0 };
}

/** Closes all (or `fraction` of) a position at market. */
export async function closePosition(params: {
  user: string;
  market: PerpMarket;
  position: PerpPosition;
  fraction?: number;
  builderApproved: boolean;
}): Promise<MarketOrderResult> {
  const { user, market, position } = params;
  const isBuy = position.size < 0;
  const size = toOrderSize(Math.abs(position.size) * (params.fraction ?? 1), market.szDecimals);
  if (!size) throw new Error('Position is too small to close partially.');
  const ref = market.midPx || market.markPx;
  const res = await exchangeFor(user).order({
    orders: [{ a: market.index, b: isBuy, p: marketPx(ref, isBuy, HL_MARKET_SLIPPAGE, market.szDecimals), s: size, r: true, t: { limit: { tif: 'Ioc' } } }],
    grouping: 'na',
    ...orderBuilder(params.builderApproved),
  });
  const first: any = res.response.data.statuses[0];
  if (first?.filled) return { filledSize: Number(first.filled.totalSz), avgPx: Number(first.filled.avgPx) };
  return { filledSize: 0, avgPx: 0 };
}

/**
 * Sets TP and/or SL for the whole position (they follow the position size). Existing position TP/SL of the
 * same kind are replaced. Pass null to remove one, undefined to keep it.
 */
export async function setPositionTpsl(params: {
  user: string;
  market: PerpMarket;
  position: PerpPosition;
  openOrders: PerpOpenOrder[];
  takeProfit: number | null | undefined;
  stopLoss: number | null | undefined;
  builderApproved: boolean;
}): Promise<void> {
  const { user, market, position, openOrders, takeProfit, stopLoss } = params;
  const ex = exchangeFor(user);
  const closeIsBuy = position.size < 0;
  const existing = openOrders.filter((o) => o.coin === market.name && o.isTrigger && o.reduceOnly);
  const isTp = (o: PerpOpenOrder) => /take profit/i.test(o.orderType);
  const toCancel = existing.filter((o) => (takeProfit !== undefined && isTp(o)) || (stopLoss !== undefined && !isTp(o)));
  if (toCancel.length) {
    await ex.cancel({ cancels: toCancel.map((o) => ({ a: market.index, o: o.oid })) });
  }
  const size = toOrderSize(Math.abs(position.size), market.szDecimals);
  if (!size) return;
  const legs: OrderLeg[] = [];
  if (takeProfit) legs.push(triggerLeg(market, closeIsBuy, size, takeProfit, 'tp'));
  if (stopLoss) legs.push(triggerLeg(market, closeIsBuy, size, stopLoss, 'sl'));
  if (!legs.length) return;
  await ex.order({ orders: legs, grouping: 'positionTpsl', ...orderBuilder(params.builderApproved) });
}

export async function cancelOrder(user: string, assetIndex: number, oid: number): Promise<void> {
  await exchangeFor(user).cancel({ cancels: [{ a: assetIndex, o: oid }] });
}
