import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldCheck, Zap, Eye, Wallet, Users, Scale, 
  ArrowRight, CheckCircle2, Lock, Smartphone, 
  Globe, ChevronDown, Menu, X, Mail, Twitter, 
  MessageCircle, Github, ArrowRightLeft, CreditCard
} from 'lucide-react';

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Home', href: '#home' },
    { name: 'How It Works', href: '#how-it-works' },
    { name: 'Features', href: '#features' },
    { name: 'Security', href: '#security' },
    { name: 'FAQ', href: '#faq' },
  ];

  return (
    <nav className={`fixed w-full z-50 transition-all duration-300 ${isScrolled ? 'bg-white/90 backdrop-blur-md shadow-sm py-3' : 'bg-transparent py-5'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <a href="#" className="text-2xl font-bold text-primary flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white">
                <ArrowRightLeft size={20} />
              </div>
              NovaP2P
            </a>
          </div>
          
          <div className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => (
              <a key={link.name} href={link.href} className="text-gray-600 hover:text-primary font-medium transition-colors">
                {link.name}
              </a>
            ))}
            <a href="#coming-soon" className="bg-primary hover:bg-primary-dark text-white px-6 py-2.5 rounded-full font-medium transition-colors shadow-lg shadow-primary/30">
              Join Waitlist
            </a>
          </div>

          <div className="md:hidden flex items-center">
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-gray-600">
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-t border-gray-100 overflow-hidden"
          >
            <div className="px-4 pt-2 pb-6 space-y-1 shadow-lg">
              {navLinks.map((link) => (
                <a 
                  key={link.name} 
                  href={link.href} 
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-3 text-base font-medium text-gray-700 hover:text-primary hover:bg-gray-50 rounded-md"
                >
                  {link.name}
                </a>
              ))}
              <a 
                href="#coming-soon" 
                onClick={() => setMobileMenuOpen(false)}
                className="block w-full text-center mt-4 bg-primary text-white px-6 py-3 rounded-xl font-medium"
              >
                Join Waitlist
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

const Hero = () => {
  return (
    <section id="home" className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
      <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[310px] w-[310px] rounded-full bg-primary opacity-20 blur-[100px]"></div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-4xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 border border-blue-100 text-primary font-medium text-sm mb-8"
          >
            <span className="animate-pulse">🚀</span> NovaP2P Launching Soon
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-gray-900 mb-6"
          >
            The Future of <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-400">Peer-to-Peer</span> Crypto Trading
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed"
          >
            NovaP2P is a secure and simple marketplace to buy and sell USDT directly with other users using our built-in escrow system.
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <a href="#coming-soon" className="w-full sm:w-auto px-8 py-4 bg-primary hover:bg-primary-dark text-white rounded-xl font-semibold text-lg transition-all shadow-lg shadow-primary/30 hover:shadow-primary/50 flex items-center justify-center gap-2">
              Join Waitlist <ArrowRight size={20} />
            </a>
            <a href="#how-it-works" className="w-full sm:w-auto px-8 py-4 bg-white hover:bg-gray-50 text-gray-800 border border-gray-200 rounded-xl font-semibold text-lg transition-all flex items-center justify-center">
              Learn How It Works
            </a>
          </motion.div>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5 }}
          className="mt-20 relative max-w-5xl mx-auto"
        >
          <div className="absolute -inset-1 bg-gradient-to-r from-primary to-accent rounded-2xl blur opacity-30"></div>
          <div className="relative bg-white rounded-2xl border border-gray-200 shadow-2xl overflow-hidden flex flex-col md:flex-row">
            {/* Mock Dashboard UI */}
            <div className="w-full md:w-2/3 p-6 border-b md:border-b-0 md:border-r border-gray-100 bg-gray-50/50">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-semibold text-gray-800">Recent Offers</h3>
                <div className="flex gap-2">
                  <span className="px-3 py-1 bg-white border border-gray-200 rounded-full text-xs font-medium">Buy USDT</span>
                  <span className="px-3 py-1 bg-white border border-gray-200 rounded-full text-xs font-medium text-gray-500">Sell USDT</span>
                </div>
              </div>
              
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-white p-4 rounded-xl border border-gray-100 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center font-bold text-primary">
                        U{i}
                      </div>
                      <div>
                        <div className="font-medium text-sm">Trader{i}99</div>
                        <div className="text-xs text-gray-500 flex items-center gap-1">
                          <CheckCircle2 size={12} className="text-accent" /> 99% completion
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-gray-800">1.02 USD</div>
                      <div className="text-xs text-gray-500">Limits: $50 - $500</div>
                    </div>
                    <button className="px-4 py-2 bg-accent/10 text-accent hover:bg-accent hover:text-white rounded-lg text-sm font-semibold transition-colors">
                      Buy
                    </button>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Mock Escrow UI */}
            <div className="w-full md:w-1/3 p-6 bg-white flex flex-col justify-center">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Lock className="text-primary" size={28} />
                </div>
                <h3 className="font-bold text-lg text-gray-800">Escrow Active</h3>
                <p className="text-sm text-gray-500">Funds are safely locked</p>
              </div>
              
              <div className="bg-gray-50 rounded-xl p-4 mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-500">Amount</span>
                  <span className="font-semibold">100.00 USDT</span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-500">Price</span>
                  <span className="font-semibold">1.02 USD</span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
                  <span className="text-gray-500">Total to Pay</span>
                  <span className="font-bold text-primary">102.00 USD</span>
                </div>
              </div>
              
              <button className="w-full py-3 bg-gray-900 text-white rounded-xl font-medium text-sm">
                I have paid
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

const About = () => {
  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row items-center gap-16">
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="lg:w-1/2"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">What is NovaP2P?</h2>
            <p className="text-lg text-gray-600 mb-8 leading-relaxed">
              NovaP2P is a peer-to-peer crypto trading platform where users can buy or sell USDT directly with others while NovaP2P safely holds funds in escrow until both parties complete the transaction.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {[
                { icon: <Zap className="text-primary" />, title: "Simplicity", desc: "Intuitive design for all experience levels." },
                { icon: <Eye className="text-primary" />, title: "Transparency", desc: "No hidden fees, clear pricing." },
                { icon: <ShieldCheck className="text-primary" />, title: "Security", desc: "Bank-grade encryption & escrow." },
                { icon: <Globe className="text-primary" />, title: "Global", desc: "Trade anywhere, anytime." }
              ].map((item, idx) => (
                <div key={idx} className="flex gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center shrink-0">
                    {item.icon}
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">{item.title}</h4>
                    <p className="text-sm text-gray-500">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="lg:w-1/2 relative mt-12 lg:mt-0"
          >
            <div className="aspect-square max-w-md mx-auto relative">
              <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-accent/20 rounded-full blur-3xl"></div>
              <div className="relative h-full w-full flex items-center justify-center">
                {/* Abstract Escrow Illustration */}
                <div className="relative w-full h-full max-w-[320px] max-h-[320px]">
                  <div className="absolute top-0 left-0 w-24 h-24 bg-white rounded-2xl shadow-xl flex items-center justify-center z-20 animate-[bounce_4s_infinite]">
                    <Users size={40} className="text-blue-500" />
                  </div>
                  <div className="absolute bottom-0 right-0 w-24 h-24 bg-white rounded-2xl shadow-xl flex items-center justify-center z-20 animate-[bounce_4s_infinite_1s]">
                    <Users size={40} className="text-green-500" />
                  </div>
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-secondary rounded-full shadow-2xl flex items-center justify-center z-10 glow-primary">
                    <Lock size={48} className="text-white" />
                  </div>
                  
                  {/* Connecting lines */}
                  <svg className="absolute inset-0 w-full h-full -z-10" viewBox="0 0 320 320">
                    <path d="M 48 48 L 160 160" stroke="#4F7DF3" strokeWidth="4" strokeDasharray="8 8" className="animate-[dash_20s_linear_infinite]" />
                    <path d="M 272 272 L 160 160" stroke="#22C55E" strokeWidth="4" strokeDasharray="8 8" className="animate-[dash_20s_linear_infinite]" />
                  </svg>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

const HowItWorks = () => {
  const steps = [
    { icon: <Users />, title: "Create Account", desc: "Users sign up and access their secure crypto wallet." },
    { icon: <Eye />, title: "Find an Offer", desc: "Browse buy or sell offers created by other traders." },
    { icon: <Lock />, title: "Start Trade", desc: "Choose an offer and start the trade while funds are locked in escrow." },
    { icon: <CreditCard />, title: "Complete Payment", desc: "The buyer sends payment through the selected method." },
    { icon: <CheckCircle2 />, title: "Crypto Released", desc: "Once payment is confirmed, the system releases USDT from escrow to the buyer." }
  ];

  return (
    <section id="how-it-works" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">How NovaP2P Works</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">A simple, secure, and transparent process to trade crypto directly with others.</p>
        </div>

        <div className="relative">
          {/* Connecting Line for Desktop */}
          <div className="hidden lg:block absolute top-1/2 left-0 w-full h-1 bg-gray-100 -translate-y-1/2 z-0"></div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-8 relative z-10">
            {steps.map((step, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                className="flex flex-col items-center text-center group"
              >
                <div className="w-16 h-16 rounded-full bg-white border-4 border-gray-50 shadow-lg flex items-center justify-center text-primary mb-6 relative group-hover:scale-110 group-hover:border-primary/20 transition-all duration-300">
                  {step.icon}
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-secondary text-white rounded-full text-xs font-bold flex items-center justify-center">
                    {idx + 1}
                  </div>
                </div>
                <h4 className="font-bold text-gray-900 mb-2">{step.title}</h4>
                <p className="text-sm text-gray-500">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const Features = () => {
  const features = [
    { icon: <Lock />, title: "Secure Escrow System", desc: "All trades are protected by an automated escrow system ensuring neither party is cheated." },
    { icon: <Zap />, title: "Fast USDT Trading", desc: "Buy and sell USDT quickly with verified traders from around the world." },
    { icon: <Eye />, title: "Transparent Pricing", desc: "View real-time offers and choose the best rate without any hidden fees." },
    { icon: <Wallet />, title: "User Wallet Integration", desc: "Each user has an internal wallet to manage balances securely and easily." },
    { icon: <ArrowRightLeft />, title: "Smart Trade Matching", desc: "Quickly find buyers and sellers in seconds with our advanced matching engine." },
    { icon: <Scale />, title: "Dispute Resolution", desc: "In case of issues, NovaP2P provides a fair, fast, and transparent dispute process." }
  ];

  return (
    <section id="features" className="py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Powerful Features</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">Everything you need to trade crypto safely and efficiently.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: idx * 0.1 }}
              className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group"
            >
              <div className="w-14 h-14 rounded-xl bg-blue-50 text-primary flex items-center justify-center mb-6 group-hover:bg-primary group-hover:text-white transition-colors">
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
              <p className="text-gray-600 leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

const WhyDifferent = () => {
  return (
    <section className="py-24 bg-secondary text-white overflow-hidden relative">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3"></div>
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-accent/10 rounded-full blur-[120px] translate-y-1/2 -translate-x-1/3"></div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Why NovaP2P is Different</h2>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">We built NovaP2P to solve the biggest problems in current peer-to-peer trading.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-8">
            {[
              { title: "Lower Fees", desc: "Simple and transparent fee structure. Keep more of your money." },
              { title: "Better Security", desc: "Built with advanced encryption and account protection from day one." },
              { title: "Simpler Interface", desc: "Easy trading experience even for beginners. No cluttered charts." },
              { title: "Community Focused", desc: "Built for traders who want freedom, transparency, and fairness." }
            ].map((item, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                className="flex gap-4"
              >
                <div className="mt-1">
                  <CheckCircle2 className="text-accent" />
                </div>
                <div>
                  <h4 className="text-xl font-bold mb-2">{item.title}</h4>
                  <p className="text-gray-400">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-sm"
          >
            <h3 className="text-2xl font-bold mb-8 text-center">Traditional vs NovaP2P</h3>
            
            <div className="space-y-6">
              <div className="flex justify-between items-center pb-4 border-b border-white/10">
                <span className="text-gray-400 w-1/3">Fees</span>
                <span className="text-red-400 w-1/3 text-center">High & Hidden</span>
                <span className="text-accent font-bold w-1/3 text-right">Low & Transparent</span>
              </div>
              <div className="flex justify-between items-center pb-4 border-b border-white/10">
                <span className="text-gray-400 w-1/3">Interface</span>
                <span className="text-red-400 w-1/3 text-center">Complex</span>
                <span className="text-accent font-bold w-1/3 text-right">Simple & Clean</span>
              </div>
              <div className="flex justify-between items-center pb-4 border-b border-white/10">
                <span className="text-gray-400 w-1/3">Support</span>
                <span className="text-red-400 w-1/3 text-center">Slow Bots</span>
                <span className="text-accent font-bold w-1/3 text-right">Fast & Human</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400 w-1/3">Security</span>
                <span className="text-red-400 w-1/3 text-center">Basic</span>
                <span className="text-accent font-bold w-1/3 text-right">Bank-Grade</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

const Security = () => {
  return (
    <section id="security" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row items-center gap-16">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="lg:w-1/2"
          >
            <div className="relative w-full max-w-md mx-auto aspect-square">
              <div className="absolute inset-0 bg-blue-50 rounded-full"></div>
              <div className="absolute inset-4 border-2 border-dashed border-blue-200 rounded-full animate-[spin_20s_linear_infinite]"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-48 h-48 bg-white rounded-full shadow-2xl flex items-center justify-center z-10 relative">
                  <ShieldCheck size={80} className="text-primary" />
                  <div className="absolute -top-4 -right-4 w-12 h-12 bg-accent rounded-full flex items-center justify-center text-white shadow-lg animate-bounce">
                    <Lock size={20} />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          <div className="lg:w-1/2 mt-12 lg:mt-0">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">Bank-Grade Security</h2>
            <p className="text-lg text-gray-600 mb-8">
              We take your security seriously. NovaP2P employs industry-leading security measures to ensure your funds and data are always protected.
            </p>

            <div className="space-y-6">
              {[
                "Escrow protection for every trade",
                "Secure wallet management infrastructure",
                "End-to-end encrypted data transmission",
                "24/7 anti-fraud monitoring systems",
                "Strict account verification (KYC)"
              ].map((text, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1 }}
                  className="flex items-center gap-4 bg-gray-50 p-4 rounded-xl"
                >
                  <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm text-accent shrink-0">
                    <ShieldCheck size={20} />
                  </div>
                  <span className="font-medium text-gray-800">{text}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const AppPreview = () => {
  return (
    <section className="py-24 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">A Glimpse Inside NovaP2P</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">Experience a clean, intuitive interface designed for seamless trading on any device.</p>
        </div>

        <div className="relative max-w-5xl mx-auto">
          {/* Desktop Mockup */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="relative rounded-2xl border border-gray-200 shadow-2xl bg-white overflow-hidden"
          >
            {/* Browser Chrome */}
            <div className="h-10 bg-gray-100 border-b border-gray-200 flex items-center px-4 gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                <div className="w-3 h-3 rounded-full bg-green-400"></div>
              </div>
              <div className="mx-auto bg-white px-4 py-1 rounded-md text-xs text-gray-400 font-medium w-64 text-center border border-gray-200">
                app.novap2p.com
              </div>
            </div>
            
            {/* App Content */}
            <div className="flex h-[500px]">
              {/* Sidebar */}
              <div className="w-64 bg-gray-50 border-r border-gray-200 p-4 hidden md:block">
                <div className="flex items-center gap-2 text-primary font-bold mb-8 px-2">
                  <ArrowRightLeft size={20} /> NovaP2P
                </div>
                <div className="space-y-2">
                  {['Dashboard', 'P2P Trading', 'My Wallet', 'Trade History', 'Settings'].map((item, i) => (
                    <div key={i} className={`px-4 py-2.5 rounded-lg text-sm font-medium ${i === 1 ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Main Content */}
              <div className="flex-1 bg-white p-6 overflow-hidden">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-gray-800">P2P Trading</h3>
                  <div className="flex gap-3">
                    <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium">Filter</button>
                    <button className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium flex items-center gap-2">
                      Create Offer
                    </button>
                  </div>
                </div>
                
                {/* Tabs */}
                <div className="flex gap-6 border-b border-gray-200 mb-6">
                  <div className="pb-3 border-b-2 border-primary text-primary font-medium text-sm">Buy USDT</div>
                  <div className="pb-3 text-gray-500 font-medium text-sm">Sell USDT</div>
                </div>
                
                <div className="overflow-x-auto pb-4">
                  <div className="min-w-[600px]">
                    {/* Table Header */}
                    <div className="grid grid-cols-4 text-xs font-medium text-gray-500 mb-3 px-4">
                      <div>Advertiser</div>
                      <div>Price</div>
                      <div>Limit/Available</div>
                      <div className="text-right">Action</div>
                    </div>
                    
                    {/* Table Rows */}
                    <div className="space-y-3">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="grid grid-cols-4 items-center bg-gray-50 p-4 rounded-xl border border-gray-100">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-100 text-primary flex items-center justify-center font-bold text-xs shrink-0">T{i}</div>
                            <div>
                              <div className="font-medium text-sm text-gray-800">TraderPro_{i}</div>
                              <div className="text-xs text-gray-500">99.{i}% completion</div>
                            </div>
                          </div>
                          <div className="font-bold text-gray-800">1.0{i} USD</div>
                          <div>
                            <div className="text-sm text-gray-800">Available: 1,000 USDT</div>
                            <div className="text-xs text-gray-500">Limit: $100 - $1,000</div>
                          </div>
                          <div className="text-right">
                            <button className="px-6 py-2 bg-accent text-white rounded-lg text-sm font-semibold hover:bg-green-600 transition-colors whitespace-nowrap">
                              Buy USDT
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Mobile Mockup - Overlapping */}
          <motion.div 
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="absolute -right-4 md:-right-12 -bottom-12 w-[280px] h-[580px] bg-gray-900 rounded-[40px] border-[8px] border-gray-900 shadow-2xl overflow-hidden z-20 hidden sm:block"
          >
            {/* Notch */}
            <div className="absolute top-0 inset-x-0 h-6 bg-gray-900 rounded-b-3xl w-40 mx-auto z-30"></div>
            
            <div className="bg-gray-50 w-full h-full flex flex-col relative">
              {/* Header */}
              <div className="bg-primary text-white pt-12 pb-6 px-6 rounded-b-3xl shadow-md">
                <div className="flex justify-between items-center mb-6">
                  <div className="font-bold text-lg">My Wallet</div>
                  <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                    <Smartphone size={16} />
                  </div>
                </div>
                <div className="text-white/80 text-sm mb-1">Total Balance</div>
                <div className="text-3xl font-bold mb-4">$4,250.00</div>
                <div className="flex gap-3">
                  <button className="flex-1 bg-white text-primary py-2 rounded-xl text-sm font-semibold">Deposit</button>
                  <button className="flex-1 bg-white/20 text-white py-2 rounded-xl text-sm font-semibold">Withdraw</button>
                </div>
              </div>
              
              {/* Content */}
              <div className="flex-1 p-6 overflow-y-auto">
                <h4 className="font-bold text-gray-800 mb-4">Assets</h4>
                <div className="space-y-4">
                  <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-100 text-green-600 rounded-full flex items-center justify-center font-bold">₮</div>
                      <div>
                        <div className="font-bold text-gray-800">USDT</div>
                        <div className="text-xs text-gray-500">Tether</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-gray-800">4,250.00</div>
                      <div className="text-xs text-gray-500">$4,250.00</div>
                    </div>
                  </div>
                </div>
                
                <h4 className="font-bold text-gray-800 mt-6 mb-4">Recent Activity</h4>
                <div className="space-y-4">
                  {[1, 2].map((i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-50 text-primary rounded-full flex items-center justify-center">
                          <ArrowRightLeft size={16} />
                        </div>
                        <div>
                          <div className="font-medium text-sm text-gray-800">Bought USDT</div>
                          <div className="text-xs text-gray-500">Today, 14:30</div>
                        </div>
                      </div>
                      <div className="font-bold text-accent text-sm">+500.00 USDT</div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Bottom Nav */}
              <div className="bg-white border-t border-gray-200 py-4 px-6 flex justify-between items-center text-gray-400">
                <div className="flex flex-col items-center gap-1"><Wallet size={20} /></div>
                <div className="flex flex-col items-center gap-1 text-primary"><ArrowRightLeft size={20} /></div>
                <div className="flex flex-col items-center gap-1"><Users size={20} /></div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

const Roadmap = () => {
  const phases = [
    { phase: "Phase 1", title: "Platform Development", status: "current" },
    { phase: "Phase 2", title: "Closed Beta Launch", status: "upcoming" },
    { phase: "Phase 3", title: "Public Launch", status: "upcoming" },
    { phase: "Phase 4", title: "Mobile App Release", status: "upcoming" },
    { phase: "Phase 5", title: "More Crypto Assets", status: "upcoming" },
  ];

  return (
    <section className="py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Our Roadmap</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">The journey to revolutionizing peer-to-peer crypto trading.</p>
        </div>

        <div className="max-w-4xl mx-auto relative">
          {/* Vertical Line */}
          <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-1 bg-gray-200 -translate-x-1/2"></div>

          <div className="space-y-12">
            {phases.map((item, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className={`relative flex flex-col md:flex-row items-start md:items-center ${idx % 2 === 0 ? 'md:flex-row-reverse' : ''}`}
              >
                {/* Center Dot */}
                <div className={`absolute left-4 md:left-1/2 w-6 h-6 rounded-full border-4 border-white -translate-x-1/2 z-10 ${item.status === 'current' ? 'bg-primary animate-pulse' : 'bg-gray-300'}`}></div>
                
                <div className={`ml-12 md:ml-0 md:w-1/2 ${idx % 2 === 0 ? 'md:pl-12' : 'md:pr-12 text-left md:text-right'}`}>
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                    <span className={`text-sm font-bold uppercase tracking-wider ${item.status === 'current' ? 'text-primary' : 'text-gray-400'}`}>
                      {item.phase}
                    </span>
                    <h4 className="text-xl font-bold text-gray-900 mt-2">{item.title}</h4>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const ComingSoon = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    
    setStatus('loading');
    
    // Simulate API call delay
    setTimeout(() => {
      setStatus('success');
      
      // Open mailto link to send the email to support@novap2p.com
      window.location.href = `mailto:support@novap2p.com?subject=New Waitlist Subscriber&body=Please add my email to the waitlist: ${email}`;
      
      setEmail('');
      
      // Reset status after a few seconds
      setTimeout(() => setStatus('idle'), 5000);
    }, 1000);
  };

  return (
    <section id="coming-soon" className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-secondary via-secondary to-primary/40"></div>
      
      {/* Animated background elements */}
      <div className="absolute top-10 left-10 w-32 h-32 bg-primary/30 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-10 right-10 w-48 h-48 bg-accent/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
        >
          <span className="px-4 py-2 rounded-full bg-white/10 border border-white/20 text-white text-sm font-medium mb-8 inline-block backdrop-blur-sm">
            Currently Under Development
          </span>
          
          <h2 className="text-4xl md:text-6xl font-extrabold text-white mb-6">
            Secure. Fast. Transparent.<br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-accent">Coming Soon.</span>
          </h2>
          
          <p className="text-xl text-gray-300 mb-10 max-w-2xl mx-auto">
            Be the first to know when we launch and get exclusive early access to NovaP2P.
          </p>

          <div className="max-w-md mx-auto relative">
            <AnimatePresence mode="wait">
              {status === 'success' ? (
                <motion.div 
                  key="success"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-accent/20 border border-accent/50 text-white px-6 py-4 rounded-2xl backdrop-blur-md flex items-center justify-center gap-3"
                >
                  <CheckCircle2 className="text-accent" size={24} />
                  <span className="font-medium">Successfully joined the waitlist!</span>
                </motion.div>
              ) : (
                <motion.form 
                  key="form"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="relative" 
                  onSubmit={handleSubmit}
                >
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email address" 
                    className="w-full px-6 py-4 rounded-full bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary backdrop-blur-md disabled:opacity-50"
                    required
                    disabled={status === 'loading'}
                  />
                  <button 
                    type="submit" 
                    disabled={status === 'loading'}
                    className="absolute right-2 top-2 bottom-2 px-6 bg-primary hover:bg-primary-dark text-white rounded-full font-medium transition-colors disabled:opacity-70 flex items-center justify-center min-w-[140px]"
                  >
                    {status === 'loading' ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      'Join Waitlist'
                    )}
                  </button>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
          
          <p className="text-sm text-gray-400 mt-4">No spam. Unsubscribe anytime.</p>
        </motion.div>
      </div>
    </section>
  );
};

const FAQ = () => {
  const faqs = [
    { q: "What is P2P trading?", a: "Peer-to-peer (P2P) trading allows users to buy and sell cryptocurrencies directly with each other without a central exchange acting as an intermediary." },
    { q: "Is NovaP2P safe?", a: "Yes. NovaP2P uses a secure escrow system that locks the cryptocurrency during a trade until the seller confirms receipt of payment, protecting both parties." },
    { q: "What cryptocurrencies will be supported?", a: "At launch, NovaP2P will primarily focus on USDT (Tether) to provide a stable trading environment. More assets will be added in later phases." },
    { q: "How does the escrow system work?", a: "When a trade starts, the seller's crypto is locked in our smart contract escrow. It is only released to the buyer once the seller confirms they have received the fiat payment." },
    { q: "When will NovaP2P launch?", a: "We are currently in the final stages of platform development. Join our waitlist to be notified about our upcoming Closed Beta launch." }
  ];

  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <section id="faq" className="py-24 bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Frequently Asked Questions</h2>
          <p className="text-lg text-gray-600">Got questions? We've got answers.</p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, idx) => (
            <div 
              key={idx} 
              className={`border rounded-2xl overflow-hidden transition-all duration-300 ${openIdx === idx ? 'border-primary shadow-md' : 'border-gray-200 hover:border-gray-300'}`}
            >
              <button 
                className="w-full px-6 py-5 text-left flex justify-between items-center bg-white focus:outline-none"
                onClick={() => setOpenIdx(openIdx === idx ? null : idx)}
              >
                <span className="font-semibold text-gray-900">{faq.q}</span>
                <ChevronDown className={`text-gray-500 transition-transform duration-300 ${openIdx === idx ? 'rotate-180 text-primary' : ''}`} />
              </button>
              <AnimatePresence>
                {openIdx === idx && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-6 pb-5 text-gray-600 border-t border-gray-100 pt-4">
                      {faq.a}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const Footer = () => {
  return (
    <footer className="bg-gray-50 pt-16 pb-8 border-t border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          <div className="col-span-1 md:col-span-2">
            <a href="#" className="text-2xl font-bold text-primary flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white">
                <ArrowRightLeft size={20} />
              </div>
              NovaP2P
            </a>
            <p className="text-gray-500 max-w-sm mb-6">
              A next-generation peer-to-peer crypto trading platform designed for simplicity, security, and speed.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:text-primary hover:border-primary transition-colors">
                <Twitter size={18} />
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:text-primary hover:border-primary transition-colors">
                <MessageCircle size={18} />
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:text-primary hover:border-primary transition-colors">
                <Mail size={18} />
              </a>
            </div>
          </div>
          
          <div>
            <h4 className="font-bold text-gray-900 mb-4">Quick Links</h4>
            <ul className="space-y-2">
              <li><a href="#home" className="text-gray-500 hover:text-primary transition-colors">Home</a></li>
              <li><a href="#how-it-works" className="text-gray-500 hover:text-primary transition-colors">How It Works</a></li>
              <li><a href="#features" className="text-gray-500 hover:text-primary transition-colors">Features</a></li>
              <li><a href="#faq" className="text-gray-500 hover:text-primary transition-colors">FAQ</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-bold text-gray-900 mb-4">Legal</h4>
            <ul className="space-y-2">
              <li><a href="#" className="text-gray-500 hover:text-primary transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="text-gray-500 hover:text-primary transition-colors">Terms of Service</a></li>
              <li><a href="#" className="text-gray-500 hover:text-primary transition-colors">Cookie Policy</a></li>
            </ul>
          </div>
        </div>
        
        <div className="pt-8 border-t border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-gray-500 text-sm">
            &copy; {new Date().getFullYear()} NovaP2P. All rights reserved.
          </p>
          <div className="flex items-center gap-2 text-sm font-medium text-primary bg-blue-50 px-4 py-2 rounded-full">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
            </span>
            🚀 NovaP2P Beta Coming Soon
          </div>
        </div>
      </div>
    </footer>
  );
};

export default function App() {
  return (
    <div className="min-h-screen bg-white font-sans selection:bg-primary/20 selection:text-primary">
      <Navbar />
      <main>
        <Hero />
        <About />
        <HowItWorks />
        <Features />
        <WhyDifferent />
        <AppPreview />
        <Security />
        <Roadmap />
        <ComingSoon />
        <FAQ />
      </main>
      <Footer />
    </div>
  );
}
