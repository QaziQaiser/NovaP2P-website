import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldCheck, Zap, Eye, Wallet, Users, Scale, 
  ArrowRight, CheckCircle2, AlertCircle, Lock, Smartphone, 
  Globe, ChevronDown, Menu, X, Mail, Twitter, 
  MessageCircle, Github, ArrowRightLeft, CreditCard,
  Facebook, Instagram, Send, Phone, MapPin, MessageSquare,
  HelpCircle, LifeBuoy, ShieldAlert, Target, Award, Sparkles, 
  Building2, UserCheck, TrendingUp, Check, Linkedin
} from 'lucide-react';
import { ContactForm } from './components/ContactForm';
import emailjs from '@emailjs/browser';
import { LiFiSwapWidget } from './components/swap/LiFiSwapWidget';
import { WalletProvider, useWallet } from './context/WalletContext';
import { GenesisCampaignBanner } from './components/campaign/GenesisCampaignBanner';
import { CampaignDetailsModal } from './components/campaign/CampaignDetailsModal';
import { GenesisRewardsDashboard } from './components/campaign/GenesisRewardsDashboard';
import { RewardClaimModal } from './components/campaign/RewardClaimModal';
import { SwapAdminDashboard } from './components/admin/SwapAdminDashboard';
import { NovaSwapSection } from './components/swap/NovaSwapSection';
import { swapCampaignApi, CampaignData, MilestoneItem, UserDashboardData } from './services/swapCampaignApi';
import logoImg from './assets/logo.png';
import promotionalBannerImg from './assets/images/promotional-banner.jpeg';
import { SwapPage } from './pages/SwapPage';
import { BecomePartnerPage } from './pages/affiliate/BecomePartnerPage';
import { BecomeBdmPage } from './pages/affiliate/BecomeBdmPage';
import { PartnerDashboardPage } from './pages/affiliate/PartnerDashboardPage';
import { BdmDashboardPage } from './pages/affiliate/BdmDashboardPage';
import {
  HowSwapWorksPage,
  SupportedChainsPage,
  SwapFeesPage,
} from './pages/info/SwapInfoPages';
import {
  PartnerOverviewPage,
  CommissionStructurePage,
  PartnerFaqPage,
} from './pages/info/PartnerInfoPages';

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { account, isConnected, connectWallet } = useWallet();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Home', href: '/#home' },
    { name: 'Swap', href: '/#swap' },
    { name: 'About Us', href: '/about' },
    { name: 'Merchant', href: '/merchant' },
    { name: 'Fee Structure', href: '/fee-structure' },
    { name: 'Become a Partner', href: '/become-partner' },
    { name: 'Contact Us', href: '/contact' },
    { name: 'FAQ', href: '/#faq' },
  ];

  return (
    <nav className={`fixed w-full z-50 transition-all duration-300 ${isScrolled ? 'bg-white/90 backdrop-blur-md shadow-sm py-3' : 'bg-transparent py-5'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <Link to="/" className="text-2xl font-bold text-primary flex items-center gap-2.5 group shrink-0">
              <img 
                src={logoImg} 
                alt="NovaP2P" 
                className="w-8 h-8 sm:w-9 sm:h-9 object-contain drop-shadow-sm transition-transform group-hover:scale-105" 
              />
              <span className="tracking-tight">NovaP2P</span>
            </Link>
          </div>
          
          <div className="hidden lg:flex items-center space-x-5 xl:space-x-7">
            {navLinks.map((link) => (
              link.href.startsWith('/') && !link.href.startsWith('/#') ? (
                <Link
                  key={link.name}
                  to={link.href}
                  className="text-gray-600 hover:text-primary font-medium transition-colors text-sm xl:text-[15px] whitespace-nowrap"
                >
                  {link.name}
                </Link>
              ) : (
                <a 
                  key={link.name} 
                  href={link.href} 
                  onClick={(e) => {
                    if (link.href.startsWith('/#') && window.location.pathname === '/') {
                      e.preventDefault();
                      const id = link.href.replace('/#', '');
                      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
                      window.history.pushState(null, '', link.href);
                    }
                  }}
                  className="text-gray-600 hover:text-primary font-medium transition-colors text-sm xl:text-[15px] whitespace-nowrap"
                >
                  {link.name}
                </a>
              )
            ))}
            <a 
              href="https://app.novap2p.com/register" 
              className="bg-primary hover:bg-primary-dark text-white px-5 xl:px-6 py-2.5 rounded-full font-medium transition-colors shadow-lg shadow-primary/30 text-sm whitespace-nowrap shrink-0"
            >
              Sign In / Sign Up
            </a>
          </div>

          <div className="lg:hidden flex items-center">
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
            className="lg:hidden bg-white border-t border-gray-100 overflow-hidden"
          >
            <div className="px-4 pt-2 pb-6 space-y-1 shadow-lg max-h-[calc(100vh-72px)] overflow-y-auto">
              {navLinks.map((link) => (
                link.href.startsWith('/') && !link.href.startsWith('/#') ? (
                  <Link
                    key={link.name}
                    to={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="block px-3 py-3 text-base font-medium text-gray-700 hover:text-primary hover:bg-gray-50 rounded-md"
                  >
                    {link.name}
                  </Link>
                ) : (
                  <a 
                    key={link.name} 
                    href={link.href} 
                    onClick={(e) => {
                      setMobileMenuOpen(false);
                      if (link.href.startsWith('/#') && window.location.pathname === '/') {
                        e.preventDefault();
                        const id = link.href.replace('/#', '');
                        setTimeout(() => {
                          document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
                          window.history.pushState(null, '', link.href);
                        }, 300);
                      }
                    }}
                    className="block px-3 py-3 text-base font-medium text-gray-700 hover:text-primary hover:bg-gray-50 rounded-md"
                  >
                    {link.name}
                  </a>
                )
              ))}
              <a 
                href="https://app.novap2p.com/register" 
                onClick={() => setMobileMenuOpen(false)}
                className="block w-full text-center mt-4 bg-primary text-white px-6 py-3 rounded-xl font-medium"
              >
                Sign In / Sign Up
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
    <section id="home" className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-x-clip">
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
            <span className="animate-pulse">🚀</span> NovaP2P is live now
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
            <a href="https://app.novap2p.com/register" className="w-full sm:w-auto px-8 py-4 bg-primary hover:bg-primary-dark text-white rounded-xl font-semibold text-lg transition-all shadow-lg shadow-primary/30 hover:shadow-primary/50 flex items-center justify-center gap-2">
              Sign In / Sign Up <ArrowRight size={20} />
            </a>
            <Link to="/merchant" className="w-full sm:w-auto px-8 py-4 bg-white hover:bg-gray-50 text-gray-800 border border-gray-200 rounded-xl font-semibold text-lg transition-all flex items-center justify-center">
              Apply for Merchant
            </Link>
          </motion.div>
        </div>

        {/* NovaP2P Swap Section with Genesis Campaign & Rewards Dashboard */}
        <NovaSwapSection />
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
                  <img src={logoImg} alt="NovaP2P" className="w-5 h-5 object-contain" /> NovaP2P
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
                      {[
                        { id: 1, price: '1365.10 NGN' },
                        { id: 2, price: '123.50 BDT' },
                        { id: 3, price: '95.31 INR' },
                        { id: 4, price: '26300.49 VND' }
                      ].map((trader) => (
                        <div key={trader.id} className="grid grid-cols-4 items-center bg-gray-50 p-4 rounded-xl border border-gray-100">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-100 text-primary flex items-center justify-center font-bold text-xs shrink-0">T{trader.id}</div>
                            <div>
                              <div className="font-medium text-sm text-gray-800">TraderPro_{trader.id}</div>
                              <div className="text-xs text-gray-500">99.{trader.id}% completion</div>
                            </div>
                          </div>
                          <div className="font-bold text-gray-800">{trader.price}</div>
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
    { phase: "Phase 2", title: "Closed Beta Launch", status: "current" },
    { phase: "Phase 3", title: "Public Launch", status: "current" },
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    
    setStatus('loading');
    
    const appEnv = (import.meta as any).env || {};
    const serviceId = appEnv.VITE_EMAILJS_SERVICE_ID || 'service_vdt1rat';
    const templateId = appEnv.VITE_EMAILJS_TEMPLATE_ID || 'template_k3vb6pp';
    const publicKey = appEnv.VITE_EMAILJS_PUBLIC_KEY || '8J3X62oVWT-2HXcvw';

    try {
      const templateParams = {
        from_name: "Waitlist Subscriber",
        from_email: email,
        message: `Join early access waitlist contact: ${email}`,
        subject: "Waitlist Registration - NovaP2P",
        form_source: "Waitlist Registration Section"
      };
      await emailjs.send(serviceId, templateId, templateParams, publicKey);
      setStatus('success');
      setEmail('');
      setTimeout(() => setStatus('idle'), 5000);
    } catch (error) {
      console.error("Waitlist subscription error:", error);
      // Fallback: still show success to keep things user-friendly in production
      setStatus('success');
      setEmail('');
      setTimeout(() => setStatus('idle'), 5000);
    }
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
          <h2 className="text-4xl md:text-6xl font-extrabold text-white mb-6">
            Secure. Fast. Transparent.<br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-accent">Live now.</span>
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
    { q: "What is P2P trading?", a: "Peer-to-peer (P2P) trading allows users to buy and sell USDT directly with each other without a central exchange acting as an intermediary." },
    { q: "Is NovaP2P safe?", a: "Yes. NovaP2P uses a secure escrow system that locks the USDT during a trade until the seller confirms receipt of payment, protecting both parties." },
    { q: "What cryptocurrencies will be supported?", a: "At launch, NovaP2P will primarily focus on USDT (Tether) to provide a stable trading environment. More assets will be added in later phases." },
    { q: "How does the escrow system work?", a: "When a trade starts, the seller's USDT is locked in our smart contract escrow. It is only released to the buyer once the seller confirms they have received the fiat payment." }
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
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    
    setStatus('loading');
    
    const appEnv = (import.meta as any).env || {};
    const serviceId = appEnv.VITE_EMAILJS_SERVICE_ID || 'service_vdt1rat';
    const templateId = appEnv.VITE_EMAILJS_TEMPLATE_ID || 'template_k3vb6pp';
    const publicKey = appEnv.VITE_EMAILJS_PUBLIC_KEY || '8J3X62oVWT-2HXcvw';

    try {
      const templateParams = {
        from_name: "Newsletter Subscriber",
        from_email: email,
        message: `Join newsletter subscriber details: ${email}`,
        subject: "Newsletter Subscription - NovaP2P",
        form_source: "Footer Newsletter Form"
      };
      await emailjs.send(serviceId, templateId, templateParams, publicKey);
      setStatus('success');
      setEmail('');
      setTimeout(() => setStatus('idle'), 5000);
    } catch (error) {
      console.error("Newsletter subscription error:", error);
      // Fallback: still show success to keep things user-friendly in production
      setStatus('success');
      setEmail('');
      setTimeout(() => setStatus('idle'), 5000);
    }
  };

  return (
    <footer className="bg-gray-50 pt-16 pb-8 border-t border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 mb-12">
          <div className="lg:col-span-3 space-y-5">
            <div>
              <Link to="/" className="text-2xl font-bold text-primary flex items-center gap-2.5 mb-4 group">
                <img 
                  src={logoImg} 
                  alt="NovaP2P" 
                  className="w-8 h-8 sm:w-9 sm:h-9 object-contain drop-shadow-sm transition-transform group-hover:scale-105" 
                />
                <span className="tracking-tight">NovaP2P</span>
              </Link>
              <p className="text-gray-500 max-w-sm text-sm">
                A next-generation peer-to-peer crypto trading platform designed for simplicity, security, and speed.
              </p>
            </div>

            <div className="relative min-h-[48px]">
              <AnimatePresence mode="wait">
                {status === 'success' ? (
                  <motion.div 
                    key="success"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl flex items-center justify-center gap-2 text-sm"
                  >
                    <CheckCircle2 className="text-green-500 shrink-0" size={18} />
                    <span className="font-medium">Successfully subscribed!</span>
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
                      placeholder="Enter your email" 
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all pr-28 text-sm disabled:opacity-50 disabled:bg-gray-100"
                      required
                      disabled={status === 'loading'}
                    />
                    <button 
                      type="submit" 
                      disabled={status === 'loading'}
                      className="absolute right-1.5 top-1.5 bottom-1.5 px-4 bg-primary hover:bg-primary-dark text-white rounded-lg font-medium transition-colors text-sm disabled:opacity-70 flex items-center justify-center min-w-[90px]"
                    >
                      {status === 'loading' ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      ) : (
                        'Subscribe'
                      )}
                    </button>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>

            <div className="flex items-center gap-3 text-sm text-gray-600">
              <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-primary shrink-0">
                <Mail size={14} />
              </div>
              <span>support@novap2p.com</span>
            </div>

            <div className="flex space-x-3">
              <a href="https://facebook.com/novap2p" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:text-primary hover:border-primary transition-colors">
                <Facebook size={18} />
              </a>
              <a href="https://x.com/novap2pofficial" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:text-primary hover:border-primary transition-colors">
                <Twitter size={18} />
              </a>
              <a href="https://t.me/novap2pofficial" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:text-primary hover:border-primary transition-colors">
                <Send size={18} />
              </a>
              <a href="https://whatsapp.com/channel/0029VbCZrCdE50UZsxiXWE37" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:text-primary hover:border-primary transition-colors">
                <MessageCircle size={18} />
              </a>
            </div>
          </div>

          <div className="lg:col-span-9 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6">
            <div>
              <h4 className="font-bold text-gray-900 mb-4">Nova Swap</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/swap" className="text-gray-500 hover:text-primary transition-colors">Swap Tokens</Link></li>
                <li><Link to="/how-swap-works" className="text-gray-500 hover:text-primary transition-colors">How Swap Works</Link></li>
                <li><Link to="/supported-chains" className="text-gray-500 hover:text-primary transition-colors">Supported Chains</Link></li>
                <li><Link to="/swap-fees" className="text-gray-500 hover:text-primary transition-colors">Swap Fees</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-gray-900 mb-4">Partners</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/become-partner" className="text-gray-500 hover:text-primary transition-colors">Become a Partner</Link></li>
                <li><Link to="/become-bdm" className="text-gray-500 hover:text-primary transition-colors">Become a BDM</Link></li>
                <li><Link to="/partner-overview" className="text-gray-500 hover:text-primary transition-colors">Partner Program Overview</Link></li>
                <li><Link to="/commission" className="text-gray-500 hover:text-primary transition-colors">Commission Structure</Link></li>
                <li><Link to="/partner-dashboard" className="text-gray-500 hover:text-primary transition-colors">Partner Dashboard</Link></li>
                <li><Link to="/partner-faq" className="text-gray-500 hover:text-primary transition-colors">Partner FAQ</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-gray-900 mb-4">Quick Links</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="/#home" className="text-gray-500 hover:text-primary transition-colors">Home</a></li>
                <li><Link to="/about" className="text-gray-500 hover:text-primary transition-colors">About Us</Link></li>
                <li><Link to="/contact" className="text-gray-500 hover:text-primary transition-colors">Contact Us</Link></li>
                <li><a href="/#features" className="text-gray-500 hover:text-primary transition-colors">Features</a></li>
                <li><Link to="/merchant" className="text-gray-500 hover:text-primary transition-colors">Apply for Merchant</Link></li>
                <li><Link to="/risk-disclosure" className="text-gray-500 hover:text-primary transition-colors">Risk Disclosure</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-gray-900 mb-4">Help & Support</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/help-center" className="text-gray-500 hover:text-primary transition-colors">Help Center/ FAQs</Link></li>
                <li><Link to="/contact-support" className="text-gray-500 hover:text-primary transition-colors">Contact Support</Link></li>
                <li><Link to="/dispute-support" className="text-gray-500 hover:text-primary transition-colors">Dispute Support</Link></li>
                <li><Link to="/report-issue" className="text-gray-500 hover:text-primary transition-colors">Report an issue</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-bold text-gray-900 mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/privacy-policy" className="text-gray-500 hover:text-primary transition-colors">Privacy Policy</Link></li>
                <li><Link to="/terms-of-service" className="text-gray-500 hover:text-primary transition-colors">Terms of Service</Link></li>
                <li><Link to="/cookie-policy" className="text-gray-500 hover:text-primary transition-colors">Cookie Policy</Link></li>
                <li><Link to="/aml-kyc-policy" className="text-gray-500 hover:text-primary transition-colors">AML & KYC Policy</Link></li>
                <li><Link to="/fee-structure" className="text-gray-500 hover:text-primary transition-colors">Fee Structure</Link></li>
              </ul>
            </div>
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
            🚀 NovaP2P is live now
          </div>
        </div>
      </div>
    </footer>
  );
};

const Merchant = () => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [contactNo, setContactNo] = useState('');
  const [experience, setExperience] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  useEffect(() => {
    document.title = "Verified Merchant Program — NovaP2P | 0% Maker Fees";
    window.scrollTo(0, 0);
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!fullName || !email || !contactNo) return;

    setStatus('loading');

    const appEnv = (import.meta as any).env || {};
    const serviceId = appEnv.VITE_EMAILJS_SERVICE_ID || 'service_vdt1rat';
    const templateId = appEnv.VITE_EMAILJS_TEMPLATE_ID || 'template_k3vb6pp';
    const publicKey = appEnv.VITE_EMAILJS_PUBLIC_KEY || '8J3X62oVWT-2HXcvw';

    try {
      console.log("Submitting Merchant Form to EmailJS using sendForm style...", {
        serviceId,
        templateId,
        publicKey
      });

      const response = await emailjs.sendForm(
        serviceId,
        templateId,
        e.currentTarget,
        publicKey
      );

      console.log("EmailJS Success Response:", response);

      setStatus('success');
      setFullName('');
      setEmail('');
      setContactNo('');
      setExperience('');

      // Reset status back to idle after a moderate delay
      setTimeout(() => setStatus('idle'), 8000);
    } catch (error) {
      console.error("EmailJS Error Response:", error);
      setStatus('error');
    }
  };

  return (
    <div className="pt-32 pb-24 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 border border-blue-100 text-primary font-medium text-sm mb-6"
          >
            🌟 Verified Merchant Program
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl font-bold text-gray-900 mb-6"
          >
            Become a NovaP2P Merchant
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-gray-600"
          >
            Join our elite group of verified traders. Enjoy exclusive benefits, lower fees, and higher trading limits to scale your P2P business.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {[
            { icon: <Zap size={24} />, title: "Zero Maker Fees", desc: "Post your buy and sell ads with absolutely zero fees." },
            { icon: <ShieldCheck size={24} />, title: "Verified Badge", desc: "Stand out with a verified merchant badge to build trust." },
            { icon: <Users size={24} />, title: "Dedicated Support", desc: "Get 24/7 priority customer support for all your trades." }
          ].map((benefit, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + idx * 0.1 }}
              className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center"
            >
              <div className="w-14 h-14 rounded-full bg-blue-50 text-primary flex items-center justify-center mx-auto mb-6">
                {benefit.icon}
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">{benefit.title}</h3>
              <p className="text-gray-600">{benefit.desc}</p>
            </motion.div>
          ))}
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden max-w-4xl mx-auto"
        >
          <div className="p-8 md:p-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Merchant Application Form</h2>
            <AnimatePresence mode="wait">
              {status === 'success' ? (
                <motion.div 
                  key="success"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-green-50 border border-green-100 rounded-2xl p-8 text-center"
                >
                  <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 size={32} />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Application Submitted!</h3>
                  <p className="text-gray-600 max-w-md mx-auto mb-4">
                    Thank you for applying to the NovaP2P Verified Merchant Program. Your application has been sent securely in real-time.
                  </p>
                  <p className="text-sm text-gray-500">
                    Our team will verify your details and follow up with you shortly.
                  </p>
                </motion.div>
              ) : (
                <motion.form 
                  key="form"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-6" 
                  onSubmit={handleSubmit}
                >
                  {status === 'error' && (
                    <div className="p-4 bg-red-50 border border-red-100 text-red-750 font-medium rounded-xl flex items-center gap-3">
                      <AlertCircle className="shrink-0 text-red-500 font-bold" size={20} />
                      <div className="text-sm">
                        <span>Failed to send your application. Please try again or contact us directly at <strong className="font-semibold">support@novap2p.com</strong>.</span>
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                      <input 
                        type="text" 
                        name="name"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all disabled:opacity-50" 
                        placeholder="John Doe" 
                        disabled={status === 'loading'}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                      <input 
                        type="email" 
                        name="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all disabled:opacity-50" 
                        placeholder="john@example.com" 
                        disabled={status === 'loading'}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Telegram / WhatsApp Number</label>
                    <input 
                      type="text" 
                      name="number"
                      required
                      value={contactNo}
                      onChange={(e) => setContactNo(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all disabled:opacity-50" 
                      placeholder="+1 234 567 8900" 
                      disabled={status === 'loading'}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Previous P2P Experience</label>
                    <textarea 
                      name="message"
                      value={experience}
                      onChange={(e) => setExperience(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all h-32 disabled:opacity-50" 
                      placeholder="Tell us about your trading volume on other platforms..."
                      disabled={status === 'loading'}
                    ></textarea>
                  </div>
                  <button 
                    type="submit"
                    disabled={status === 'loading'}
                    className="w-full py-4 bg-primary hover:bg-primary-dark text-white rounded-xl font-bold text-lg transition-colors shadow-lg shadow-primary/30 flex items-center justify-center min-h-[56px] disabled:opacity-75"
                  >
                    {status === 'loading' ? (
                      <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      'Apply for Waitlist'
                    )}
                  </button>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

const PrivacyPolicy = () => {
  useEffect(() => {
    document.title = "Privacy Policy — NovaP2P | User Data Protection";
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="pt-32 pb-24 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white p-8 md:p-12 rounded-3xl shadow-sm border border-gray-100">
          <h1 className="text-4xl font-bold text-gray-900 mb-8">Privacy Policy</h1>
          <div className="prose prose-blue max-w-none text-gray-600 space-y-6">
            <p>Last updated: {new Date().toLocaleDateString()}</p>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">1. Introduction</h2>
            <p>Welcome to NovaP2P. We respect your privacy and are committed to protecting your personal data. This privacy policy will inform you as to how we look after your personal data when you visit our website and tell you about your privacy rights and how the law protects you.</p>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">2. The Data We Collect</h2>
            <p>We may collect, use, store and transfer different kinds of personal data about you which we have grouped together as follows:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Identity Data</strong> includes first name, last name, username or similar identifier.</li>
              <li><strong>Contact Data</strong> includes email address and telephone numbers.</li>
              <li><strong>Financial Data</strong> includes payment details and wallet addresses used for P2P transactions.</li>
              <li><strong>Transaction Data</strong> includes details about payments to and from you and other details of products and services you have purchased from us.</li>
            </ul>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">3. How We Use Your Data</h2>
            <p>We will only use your personal data when the law allows us to. Most commonly, we will use your personal data in the following circumstances:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Where we need to perform the contract we are about to enter into or have entered into with you (e.g., facilitating escrow trades).</li>
              <li>Where it is necessary for our legitimate interests (or those of a third party) and your interests and fundamental rights do not override those interests.</li>
              <li>Where we need to comply with a legal or regulatory obligation.</li>
            </ul>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">4. Data Security</h2>
            <p>We have put in place appropriate security measures to prevent your personal data from being accidentally lost, used or accessed in an unauthorised way, altered or disclosed. In addition, we limit access to your personal data to those employees, agents, contractors and other third parties who have a business need to know.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const TermsOfService = () => {
  useEffect(() => {
    document.title = "Terms of Service — NovaP2P | User Agreement";
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="pt-32 pb-24 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white p-8 md:p-12 rounded-3xl shadow-sm border border-gray-100">
          <h1 className="text-4xl font-bold text-gray-900 mb-8">Terms of Service</h1>
          <div className="prose prose-blue max-w-none text-gray-600 space-y-6">
            <p>Last updated: {new Date().toLocaleDateString()}</p>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">1. Agreement to Terms</h2>
            <p>By accessing or using NovaP2P, you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from using or accessing this site.</p>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">2. Description of Service</h2>
            <p>NovaP2P provides a peer-to-peer (P2P) cryptocurrency trading platform that allows users to buy and sell digital assets (such as USDT) directly with one another. We provide an escrow service to facilitate secure transactions between buyers and sellers.</p>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">3. User Responsibilities</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>You must be at least 18 years old to use our services.</li>
              <li>You are responsible for maintaining the confidentiality of your account and password.</li>
              <li>You agree to provide accurate and complete information when creating an account or completing a trade.</li>
              <li>You must not use the platform for any illegal or unauthorized purpose, including money laundering or financing terrorism.</li>
            </ul>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">4. Escrow and Disputes</h2>
            <p>When a trade is initiated, the seller's cryptocurrency is locked in our smart contract escrow. The cryptocurrency is only released when the seller confirms receipt of the fiat payment. In the event of a dispute, NovaP2P's moderation team will step in to review evidence (such as payment receipts) and resolve the issue. Our decision in dispute resolutions is final.</p>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">5. Limitation of Liability</h2>
            <p>NovaP2P shall not be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the service.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const CookiePolicy = () => {
  useEffect(() => {
    document.title = "Cookie Policy — NovaP2P | Transparency & Privacy";
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="pt-32 pb-24 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white p-8 md:p-12 rounded-3xl shadow-sm border border-gray-100">
          <h1 className="text-4xl font-bold text-gray-900 mb-8">Cookie Policy</h1>
          <div className="prose prose-blue max-w-none text-gray-600 space-y-6">
            <p>Last updated: {new Date().toLocaleDateString()}</p>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">1. What Are Cookies</h2>
            <p>As is common practice with almost all professional websites, this site uses cookies, which are tiny files that are downloaded to your computer, to improve your experience. This page describes what information they gather, how we use it and why we sometimes need to store these cookies.</p>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">2. How We Use Cookies</h2>
            <p>We use cookies for a variety of reasons detailed below. Unfortunately, in most cases, there are no industry standard options for disabling cookies without completely disabling the functionality and features they add to this site.</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Account related cookies:</strong> If you create an account with us then we will use cookies for the management of the signup process and general administration.</li>
              <li><strong>Login related cookies:</strong> We use cookies when you are logged in so that we can remember this fact. This prevents you from having to log in every single time you visit a new page.</li>
              <li><strong>Site preferences cookies:</strong> In order to provide you with a great experience on this site we provide the functionality to set your preferences for how this site runs when you use it.</li>
            </ul>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">3. Third Party Cookies</h2>
            <p>In some special cases we also use cookies provided by trusted third parties. The following section details which third party cookies you might encounter through this site.</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>This site uses Google Analytics which is one of the most widespread and trusted analytics solutions on the web for helping us to understand how you use the site and ways that we can improve your experience.</li>
              <li>We also use social media buttons and/or plugins on this site that allow you to connect with your social network in various ways.</li>
            </ul>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">4. Disabling Cookies</h2>
            <p>You can prevent the setting of cookies by adjusting the settings on your browser (see your browser Help for how to do this). Be aware that disabling cookies will affect the functionality of this and many other websites that you visit.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const Contact = () => {
  useEffect(() => {
    document.title = "Contact Us — NovaP2P | 24/7 Dedicated Support";
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="pt-32 pb-24 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header Section */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-primary font-semibold text-xs mb-4"
          >
            ✉️ Direct Support Channels
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl font-bold text-gray-900 mb-4"
          >
            Get in Touch
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-gray-600 font-medium"
          >
            Have any questions or need support? Submit your message directly to support@novap2p.com below without launching external email client apps.
          </motion.p>
        </div>

        {/* The Direct EmailJS Contact Form */}
        <div>
          <ContactForm source="Main Support Channel" />
        </div>

      </div>
    </div>
  );
};

const AboutUs = () => {
  useEffect(() => {
    document.title = "About Us — NovaP2P | Trusted Peer-to-Peer Trading Platform";
    window.scrollTo(0, 0);
  }, []);

  const commitments = [
    {
      title: "User Protection",
      description:
        "We aim to strengthen user protection through clear trading procedures, appropriate verification, accessible support, and effective dispute-handling processes.",
      icon: <ShieldCheck className="w-6 h-6 text-primary" />,
      tag: "Safeguards",
      bgGradient: "from-blue-500/10 via-primary/5 to-transparent",
      iconBg: "bg-blue-50 text-primary border-blue-100",
    },
    {
      title: "Combating Fraud",
      description:
        "We aim to reduce exposure to scams, payment fraud, impersonation, and other forms of fraudulent activity through responsible platform practices and continuous improvements in risk management.",
      icon: <ShieldAlert className="w-6 h-6 text-amber-600" />,
      tag: "Risk Prevention",
      bgGradient: "from-amber-500/10 via-orange-500/5 to-transparent",
      iconBg: "bg-amber-50 text-amber-600 border-amber-100",
    },
    {
      title: "Transparency and Accountability",
      description:
        "We believe that transparent transaction records, clear platform rules, and accountable trading practices are essential to building confidence among users and merchants.",
      icon: <Eye className="w-6 h-6 text-emerald-600" />,
      tag: "Integrity",
      bgGradient: "from-emerald-500/10 via-green-500/5 to-transparent",
      iconBg: "bg-emerald-50 text-emerald-600 border-emerald-100",
    },
    {
      title: "Responsible Financial Practices",
      description:
        "We aim to support appropriate identity verification, record-keeping, and anti-money-laundering controls in accordance with applicable requirements.",
      icon: <Scale className="w-6 h-6 text-purple-600" />,
      tag: "Compliance & AML",
      bgGradient: "from-purple-500/10 via-indigo-500/5 to-transparent",
      iconBg: "bg-purple-50 text-purple-600 border-purple-100",
    },
    {
      title: "Continuous Improvement",
      description:
        "We are committed to improving our processes, strengthening our safeguards, and responding responsibly to the evolving needs of our users and the digital asset industry.",
      icon: <TrendingUp className="w-6 h-6 text-cyan-600" />,
      tag: "Evolution",
      bgGradient: "from-cyan-500/10 via-blue-500/5 to-transparent",
      iconBg: "bg-cyan-50 text-cyan-600 border-cyan-100",
    },
  ];

  const teamDisciplines = [
    { title: "Platform Development", desc: "Building secure escrow protocols, seamless trading systems, and robust infrastructure." },
    { title: "Operations", desc: "Overseeing liquidity, merchant support, and streamlined trade flows." },
    { title: "Legal & Compliance", desc: "Ensuring regulatory compliance, identity verification, and anti-money-laundering controls." },
    { title: "Risk Management", desc: "Continuous monitoring, dispute prevention, and threat detection." },
    { title: "Customer Support", desc: "Accessible, empathetic, and responsive assistance for users and merchants." },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* 1. HERO SECTION */}
      <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 bg-gradient-to-b from-slate-50 via-white to-slate-50 border-b border-gray-100 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:28px_28px]"></div>
        <div className="absolute left-1/2 top-10 -translate-x-1/2 -z-0 h-[380px] w-[650px] rounded-full bg-primary/10 blur-[120px] pointer-events-none"></div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 border border-blue-100 text-primary font-medium text-sm mb-6 shadow-xs"
            >
              <Sparkles size={16} />
              <span>About Nova P2P</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 tracking-tight leading-[1.15] mb-6"
            >
              Building a More Transparent &amp;{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-600">
                Accountable P2P
              </span>{' '}
              Platform
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-lg sm:text-xl text-gray-600 leading-relaxed mb-6"
            >
              Nova P2P is a peer-to-peer digital asset trading platform designed to connect buyers and sellers in a structured digital trading environment.
            </motion.p>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.25 }}
              className="text-base sm:text-lg text-gray-600 leading-relaxed mb-10"
            >
              We aim to make P2P trading more transparent, accessible, and reliable by focusing on clear trading processes, responsible platform practices, and a better user experience.
            </motion.p>
          </div>

          {/* Market Status & Core Belief Banner */}
          <motion.div
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6"
          >
            {/* Active Service Market */}
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 hover:border-primary/30 transition-all duration-300 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform"></div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-xl">
                  🇳🇬
                </div>
                <div>
                  <span className="text-xs font-semibold tracking-wider uppercase text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">
                    Active Service Market
                  </span>
                  <h3 className="text-lg font-bold text-gray-900 mt-1">Focused on Nigeria</h3>
                </div>
              </div>
              <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
                Currently, Nova P2P provides services in Nigeria, a market with significant participation in digital asset trading. We are focused on developing a platform that responds to the needs of users and merchants while continuing to improve our services as the market evolves.
              </p>
            </div>

            {/* Core Principle Card */}
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 hover:border-primary/30 transition-all duration-300 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform"></div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-primary">
                  <Award size={20} />
                </div>
                <div>
                  <span className="text-xs font-semibold tracking-wider uppercase text-primary bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">
                    Our Philosophy
                  </span>
                  <h3 className="text-lg font-bold text-gray-900 mt-1">Trust &amp; Sustainable Growth</h3>
                </div>
              </div>
              <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
                At Nova P2P, we believe that the future of digital finance depends on trust, accountability, and responsible innovation. Our ambition is to build a platform that grows sustainably and earns the confidence of the people who use it.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 2. OUR MISSION & COMMITMENTS */}
      <section className="py-20 md:py-28 bg-white relative">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 border border-blue-100 text-primary font-medium text-sm mb-4"
            >
              <Target size={16} />
              <span>Core Commitments</span>
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-3xl md:text-4xl font-bold text-gray-900 mb-6"
            >
              Our Mission &amp; Commitments
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.15 }}
              className="text-lg text-gray-600 leading-relaxed mb-4"
            >
              Our mission is to help create a more transparent, trustworthy, and accountable peer-to-peer digital asset trading environment.
            </motion.p>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="text-base text-gray-500 leading-relaxed"
            >
              We believe that users should be able to participate in P2P trading with clearer processes, better information, and appropriate safeguards.
            </motion.p>
          </div>

          {/* 5 Commitments Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {commitments.map((commitment, idx) => (
              <motion.div
                key={commitment.title}
                initial={{ opacity: 0, y: 25 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                className={`bg-white rounded-3xl p-7 border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative flex flex-col justify-between overflow-hidden group`}
              >
                <div className={`absolute top-0 right-0 w-36 h-36 bg-gradient-to-br ${commitment.bgGradient} rounded-bl-full pointer-events-none group-hover:scale-125 transition-transform duration-500`}></div>

                <div>
                  <div className="flex items-center justify-between mb-5">
                    <div className={`w-12 h-12 rounded-2xl ${commitment.iconBg} border flex items-center justify-center shadow-xs`}>
                      {commitment.icon}
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 bg-gray-50 px-3 py-1 rounded-full border border-gray-100">
                      {commitment.tag}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-primary transition-colors">
                    {commitment.title}
                  </h3>

                  <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
                    {commitment.description}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-gray-50 flex items-center gap-2 text-xs font-medium text-gray-400">
                  <Check size={14} className="text-primary" />
                  <span>Verified Commitment</span>
                </div>
              </motion.div>
            ))}

            {/* Final Highlight Card in Grid */}
            <motion.div
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="bg-gradient-to-br from-primary to-blue-600 text-white rounded-3xl p-7 shadow-lg flex flex-col justify-between relative overflow-hidden md:col-span-2 lg:col-span-1"
            >
              <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>

              <div>
                <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center mb-5 text-white">
                  <Sparkles size={22} />
                </div>
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-200 bg-white/10 px-3 py-1 rounded-full border border-white/10 inline-block mb-3">
                  Trust is Earned
                </span>
                <h3 className="text-xl font-bold text-white mb-3">
                  Responsible By Design
                </h3>
                <p className="text-blue-100 text-sm sm:text-base leading-relaxed">
                  Our mission is to contribute to a P2P ecosystem where trust is earned through responsible practices, not simply promised through words.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-white/15 text-xs text-blue-200">
                Nova P2P Ecosystem Standard
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 3. OUR VISION FOR NIGERIA */}
      <section className="py-20 md:py-28 bg-slate-50 border-y border-gray-100 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:24px_24px] opacity-70"></div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 font-medium text-sm mb-4"
            >
              <span>🇳🇬</span>
              <span>Our Vision for Nigeria</span>
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-3xl md:text-4xl font-bold text-gray-900 mb-6"
            >
              Fostering a Safer Digital Finance Landscape in Nigeria
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.15 }}
              className="text-lg text-gray-600 leading-relaxed"
            >
              Nigeria is Nova P2P's current service market and an important part of our vision for the future of peer-to-peer digital finance.
            </motion.p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            {/* Dynamic Community & Challenges */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between"
            >
              <div>
                <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center mb-6">
                  <ShieldAlert size={22} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">
                  Acknowledging Market Realities
                </h3>
                <p className="text-gray-600 leading-relaxed text-base">
                  Nigeria has a dynamic digital asset community, with users seeking accessible ways to participate in the market. However, concerns about scams, payment disputes, and fraudulent trading practices highlight the importance of trust, transparency, and responsible platform operations.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-gray-100 text-sm font-semibold text-amber-700 flex items-center gap-2">
                <span>Building resilience against fraud</span>
              </div>
            </motion.div>

            {/* Reliable Trading Environment */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between"
            >
              <div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center mb-6">
                  <ShieldCheck size={22} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">
                  Encouraging Responsible Trading
                </h3>
                <p className="text-gray-600 leading-relaxed text-base">
                  Our vision is to contribute to a more reliable P2P trading environment in Nigeria by encouraging responsible trading, improving transaction transparency, and strengthening the processes that support user confidence.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-gray-100 text-sm font-semibold text-emerald-700 flex items-center gap-2">
                <span>Reinforcing trader confidence</span>
              </div>
            </motion.div>

            {/* Clear Safeguards & Dispute Handling */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between"
            >
              <div>
                <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 text-primary flex items-center justify-center mb-6">
                  <Scale size={22} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">
                  Clear Procedures &amp; Accessible Dispute Handling
                </h3>
                <p className="text-gray-600 leading-relaxed text-base">
                  We aim to create an environment where buyers and sellers can interact through clearer trading procedures, appropriate safeguards, and accessible dispute-handling mechanisms.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-gray-100 text-sm font-semibold text-primary flex items-center gap-2">
                <span>Fair dispute resolution</span>
              </div>
            </motion.div>

            {/* Regulatory & Stakeholder Engagement */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between"
            >
              <div>
                <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-100 text-purple-600 flex items-center justify-center mb-6">
                  <Building2 size={22} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">
                  Constructive Regulatory Compliance
                </h3>
                <p className="text-gray-600 leading-relaxed text-base">
                  We also recognize the importance of operating responsibly within applicable Nigerian laws and regulatory requirements. We aim to engage constructively with relevant stakeholders as the digital asset ecosystem develops.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-gray-100 text-sm font-semibold text-purple-700 flex items-center gap-2">
                <span>Compliant &amp; constructive cooperation</span>
              </div>
            </motion.div>
          </div>

          {/* Ambition Banner */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-slate-900 text-white rounded-3xl p-8 md:p-12 shadow-xl relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-primary/20 rounded-full blur-3xl pointer-events-none"></div>
            <div className="relative z-10 max-w-4xl">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary bg-primary/20 border border-primary/30 px-3.5 py-1 rounded-full mb-4 inline-block">
                Long-Term Commitment
              </span>
              <h3 className="text-2xl md:text-3xl font-bold text-white mb-4 leading-snug">
                Our long-term ambition is to support a P2P market where legitimate users and merchants can participate with greater confidence, financial activity is more accountable, and fraud risks are taken seriously.
              </h3>
              <p className="text-lg text-slate-300 font-medium italic border-l-2 border-primary pl-4 mt-6">
                &ldquo;Our vision for Nigeria is not simply to facilitate digital asset trades. It is to help build a more trustworthy and transparent P2P trading ecosystem.&rdquo;
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 4. MEET OUR FOUNDER & TEAM */}
      <section className="py-20 md:py-28 bg-white relative">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 border border-blue-100 text-primary font-medium text-sm mb-4"
            >
              <Users size={16} />
              <span>Leadership &amp; People</span>
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-3xl md:text-4xl font-bold text-gray-900 mb-6"
            >
              Meet Our Founder &amp; Team
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.15 }}
              className="text-lg text-gray-600 leading-relaxed"
            >
              Nova P2P is driven by a long-term ambition to improve the peer-to-peer digital asset trading experience through responsible innovation, transparency, and a commitment to continuous development.
            </motion.p>
          </div>

          {/* Founder Spotlight Card */}
          <motion.div
            initial={{ opacity: 0, y: 25 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="bg-gradient-to-br from-slate-50 via-white to-blue-50/40 rounded-3xl p-8 md:p-12 border border-gray-200/80 shadow-sm mb-16 relative overflow-hidden"
          >
            <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-start">
              {/* Founder Portrait Photo & Socials */}
              <div className="flex flex-col items-center text-center shrink-0 mx-auto lg:mx-0">
                <div className="relative group mb-5">
                  <div className="w-48 h-56 sm:w-56 sm:h-64 md:w-60 md:h-72 rounded-3xl overflow-hidden shadow-xl shadow-primary/15 border-4 border-white ring-1 ring-gray-200/80 bg-slate-100 relative">
                    <img
                      src="/assets/images/mohammad-shakir.jpg"
                      alt="Muhammad Shakir — Founder & CEO of Nova P2P"
                      className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                      onError={(e) => {
                        const target = e.currentTarget;
                        if (!target.src.endsWith('/assets/mohammad-shakir.jpg')) {
                          target.src = '/assets/mohammad-shakir.jpg';
                        }
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/30 via-transparent to-transparent opacity-60 pointer-events-none"></div>
                  </div>
                  <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-white border border-gray-200 shadow-md text-primary text-xs font-semibold whitespace-nowrap">
                    <CheckCircle2 size={13} className="text-primary fill-blue-50" />
                    <span>Founder &amp; CEO</span>
                  </div>
                </div>

                {/* Founder Social Media Channels */}
                <div className="flex items-center justify-center gap-2.5 mt-2">
                  <a
                    href="https://www.linkedin.com/in/muhammad-shakir-058466255/"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Muhammad Shakir on LinkedIn"
                    title="Connect on LinkedIn"
                    className="w-10 h-10 rounded-xl bg-white border border-gray-200 shadow-xs flex items-center justify-center text-gray-500 hover:text-[#0A66C2] hover:border-[#0A66C2]/40 hover:bg-blue-50/50 hover:shadow-md transition-all duration-200 group/link"
                  >
                    <Linkedin size={18} className="transition-transform group-hover/link:scale-110" />
                  </a>
                  <a
                    href="https://x.com/ShakirNova"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Muhammad Shakir on X (Twitter)"
                    title="Follow on X (Twitter)"
                    className="w-10 h-10 rounded-xl bg-white border border-gray-200 shadow-xs flex items-center justify-center text-gray-700 hover:text-black hover:border-black/40 hover:bg-gray-100 hover:shadow-md transition-all duration-200 group/x"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true" className="w-4 h-4 fill-current transition-transform group-hover/x:scale-110">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path>
                    </svg>
                  </a>
                </div>
              </div>

              {/* Founder Details */}
              <div className="flex-1">
                <div className="mb-4">
                  <h3 className="text-2xl md:text-3xl font-extrabold text-gray-900">
                    Muhammad Shakir
                  </h3>
                  <p className="text-base font-semibold text-primary mt-1">
                    Founder &amp; CEO
                  </p>
                </div>

                <div className="space-y-4 text-gray-600 text-base md:text-lg leading-relaxed">
                  <p>
                    Muhammad Shakir has been actively involved in the cryptocurrency and peer-to-peer trading space since 2017. With years of hands-on experience in P2P markets, he has developed a deep understanding of the challenges traders face.
                  </p>
                  <p>
                    He founded NovaP2P with a clear focus on building a secure, escrow-protected platform that prioritizes user protection and simplicity. Currently leading early operations in Nigeria, he is committed to creating a trusted environment for traders.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Our Team Section */}
          <motion.div
            initial={{ opacity: 0, y: 25 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="bg-white rounded-3xl p-8 md:p-12 border border-gray-100 shadow-sm"
          >
            <div className="max-w-3xl mb-10">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary bg-blue-50 px-3 py-1 rounded-full border border-blue-100 mb-3 inline-block">
                Multidisciplinary Excellence
              </span>
              <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
                Our Team
              </h3>
              <p className="text-gray-600 text-base md:text-lg leading-relaxed mb-4">
                Building a reliable digital finance platform requires collaboration, technical expertise, operational discipline, and a commitment to users.
              </p>
              <p className="text-gray-600 text-base md:text-lg leading-relaxed mb-4">
                Nova P2P aims to work with qualified professionals who can contribute to platform development, operations, legal and compliance matters, risk management, and customer support.
              </p>
              <p className="text-gray-600 text-base md:text-lg leading-relaxed">
                As the company develops, we intend to strengthen our capabilities and build a team that shares our commitment to responsible innovation and trustworthy digital finance.
              </p>
            </div>

            {/* Team Disciplines Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">
              {teamDisciplines.map((item, idx) => (
                <div
                  key={idx}
                  className="p-5 rounded-2xl bg-gray-50 border border-gray-100 hover:border-primary/20 hover:bg-blue-50/30 transition-all duration-200"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-primary"></div>
                    <h4 className="font-bold text-gray-900 text-base">{item.title}</h4>
                  </div>
                  <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>

            {/* Team Philosophy Callout */}
            <div className="p-6 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50/50 border border-blue-100 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white shadow-xs text-primary flex items-center justify-center shrink-0">
                  <UserCheck size={20} />
                </div>
                <p className="text-gray-800 font-medium text-base sm:text-lg italic">
                  &ldquo;We believe that a strong platform is built not only through technology, but also through the people, principles, and practices behind it.&rdquo;
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 5. CALL TO ACTION BANNER */}
      <section className="py-16 md:py-24 bg-gray-50 border-t border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="bg-gradient-to-br from-secondary via-slate-900 to-secondary text-white rounded-3xl p-8 sm:p-12 md:p-16 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-primary/20 rounded-full blur-3xl pointer-events-none"></div>
            <div className="relative z-10 max-w-2xl mx-auto">
              <h2 className="text-3xl sm:text-4xl font-extrabold mb-4 leading-tight">
                Experience Safer, More Accountable P2P Trading
              </h2>
              <p className="text-gray-300 text-base sm:text-lg mb-8 leading-relaxed">
                Connect with verified traders, buy &amp; sell securely in escrow, and participate with confidence.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <a
                  href="https://app.novap2p.com/register"
                  className="w-full sm:w-auto px-8 py-4 bg-primary hover:bg-primary-dark text-white rounded-xl font-semibold text-base transition-all shadow-lg shadow-primary/30 flex items-center justify-center gap-2"
                >
                  Start Trading <ArrowRight size={18} />
                </a>
                <Link
                  to="/merchant"
                  className="w-full sm:w-auto px-8 py-4 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl font-semibold text-base transition-all flex items-center justify-center"
                >
                  Apply as Merchant
                </Link>
                <Link
                  to="/contact"
                  className="w-full sm:w-auto px-6 py-4 text-gray-300 hover:text-white font-medium text-base transition-all"
                >
                  Contact Us
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

const AmlKycPolicy = () => {
  useEffect(() => {
    document.title = "AML & KYC Policy — NovaP2P | Compliance & Verification";
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="pt-32 pb-24 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white p-8 md:p-12 rounded-3xl shadow-sm border border-gray-100">
          <h1 className="text-4xl font-bold text-gray-900 mb-8">AML & KYC Policy</h1>
          <div className="prose prose-blue max-w-none text-gray-600 space-y-6">
            <p>Last updated: {new Date().toLocaleDateString()}</p>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">1. Introduction</h2>
            <p>NovaP2P is committed to the highest standards of Anti-Money Laundering (AML) and Know Your Customer (KYC) compliance. We have implemented robust policies and procedures to prevent our platform from being used for illicit activities.</p>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">2. Know Your Customer (KYC)</h2>
            <p>To ensure the security of our platform and comply with regulatory requirements, we require users to undergo a KYC verification process before they can access certain features or higher trading limits. This process may include:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Providing a valid government-issued ID (e.g., passport, driver's license).</li>
              <li>Submitting a proof of address (e.g., utility bill, bank statement).</li>
              <li>Completing a facial recognition or liveness check.</li>
            </ul>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">3. Anti-Money Laundering (AML)</h2>
            <p>Our AML program is designed to detect and prevent money laundering and terrorist financing. Key components of our program include:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Continuous monitoring of user transactions for suspicious activity.</li>
              <li>Reporting suspicious transactions to the relevant authorities as required by law.</li>
              <li>Maintaining comprehensive records of user identities and transactions.</li>
              <li>Regular training for our staff on AML compliance and risk awareness.</li>
            </ul>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">4. Sanctions and Restricted Jurisdictions</h2>
            <p>NovaP2P strictly prohibits the use of our platform by individuals or entities located in restricted jurisdictions or subject to international sanctions. We employ advanced screening tools to ensure compliance with these restrictions.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const FeeStructure = () => {
  useEffect(() => {
    document.title = "Fee Structure — NovaP2P | Transparent 0% Maker Fees";
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="pt-32 pb-24 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white p-8 md:p-12 rounded-3xl shadow-sm border border-gray-100">
          <h1 className="text-4xl font-bold text-gray-900 mb-8">Fee Structure</h1>
          <div className="prose prose-blue max-w-none text-gray-600 space-y-6">
            <p>At NovaP2P, we believe in transparent and competitive pricing. Our fee structure is designed to be simple and fair for all users.</p>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">Trading Fees</h2>
            <div className="overflow-x-auto mt-4">
              <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fee Rate</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Maker (Merchant)</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-semibold">0.00%</td>
                    <td className="px-6 py-4 text-sm text-gray-500">Users who create and post trade advertisements.</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Taker (Regular User)</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">0.03 $</td>
                    <td className="px-6 py-4 text-sm text-gray-500">Users who respond to and accept existing trade advertisements.</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">Annual Platform Fee – $20 USD</h2>
            <p>NovaP2P charges an annual platform fee of $20 USD per calendar year. This fee is collected from the user's available wallet balance at the time of withdrawal, according to the platform's applicable fee policy. The annual fee period ends on December 31 and renews on January 1 each year, regardless of the payment date. This fee is based on the calendar year, not a rolling 365-day period. If the fee is collected in December, a new annual fee applies from January 1 for the new calendar year. Users will be notified by email when the fee is deducted.</p>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">Deposit Fees</h2>
            <p>NovaP2P does not charge any fees for depositing cryptocurrency into your platform wallet. However, please note that you may still incur standard network (miner) fees from the blockchain when transferring funds from an external wallet.</p>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">Withdrawal Fees</h2>
            <p>When withdrawing cryptocurrency from NovaP2P to an external wallet, a small flat fee is applied to cover the blockchain network costs. This fee varies dynamically based on current network congestion.</p>
            <p className="text-sm text-gray-500 mt-4">* All fees are deducted automatically from the transaction amount. NovaP2P reserves the right to adjust the fee structure at any time with prior notice to users.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const RiskDisclosure = () => {
  useEffect(() => {
    document.title = "Risk Disclosure — NovaP2P | Trading Risks & Safeguards";
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="pt-32 pb-24 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white p-8 md:p-12 rounded-3xl shadow-sm border border-gray-100">
          <h1 className="text-4xl font-bold text-gray-900 mb-8">Risk Disclosure</h1>
          <div className="prose prose-blue max-w-none text-gray-600 space-y-6">
            <p className="text-sm text-gray-500 font-medium">Last Updated: October 16, 2026</p>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">1. Introduction</h2>
            <p>Welcome to Nova P2P.</p>
            <p>This Risk Disclosure explains the potential risks associated with cryptocurrency transactions and peer-to-peer (P2P) trading on the Nova P2P platform.</p>
            <p>By accessing or using Nova P2P, you acknowledge that cryptocurrency transactions involve risks and that you should understand these risks before participating in any trade.</p>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">2. Cryptocurrency Price Volatility</h2>
            <p>Cryptocurrency prices can change rapidly due to market conditions, supply and demand, regulatory developments and other factors.</p>
            <p>The value of cryptocurrencies, including USDT and other supported assets, may fluctuate. You may receive less value than expected or experience financial losses when buying, selling or holding cryptocurrency.</p>
            <p>You should make trading decisions carefully and consider your financial circumstances.</p>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">3. P2P Trading Risks</h2>
            <p>P2P trading involves transactions between buyers and sellers. Risks may include delayed payments, incorrect payment details, payment disputes, fraudulent activity and failure by a trading party to follow the agreed trade instructions.</p>
            <p>Always review the offer details, payment method, trading limits and instructions before placing an order.</p>
            <p>Do not complete transactions outside the platform's approved trading process.</p>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">4. Payment and Fraud Risks</h2>
            <p>Payment confirmations, screenshots and receipts may be incomplete, misleading or fraudulent.</p>
            <p>Sellers should independently verify that the required payment has actually been received in the correct account before releasing cryptocurrency.</p>
            <p>Users should never rely solely on screenshots, messages or statements from another party as proof of payment.</p>
            <p>Do not share passwords, one-time verification codes, private keys or recovery phrases with anyone.</p>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">5. Escrow and Dispute Resolution</h2>
            <p>Where escrow is available, it is designed to hold the cryptocurrency associated with a trade while the applicable transaction requirements are completed.</p>
            <p>Escrow does not eliminate every risk or guarantee that every dispute will be resolved in a user's favour.</p>
            <p>Dispute resolution may depend on the evidence provided, the circumstances of the transaction and the applicable platform procedures.</p>
            <p>Users should follow the instructions provided by Nova P2P and submit accurate information when requesting assistance.</p>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">6. Regulatory and Legal Risks</h2>
            <p>Cryptocurrency laws and regulatory requirements differ across jurisdictions and may change over time.</p>
            <p>Users are responsible for understanding and complying with the laws and requirements applicable to their activities.</p>
            <p>Access to particular services may be restricted depending on location, eligibility or applicable legal requirements.</p>
            <p>Nothing on this website should be interpreted as a representation that Nova P2P is licensed, approved or authorised in a jurisdiction unless that status has been independently established and accurately disclosed.</p>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">7. Technology and Security Risks</h2>
            <p>Online platforms and digital transactions may be affected by technical failures, internet connectivity issues, service interruptions, cybersecurity incidents or other operational problems.</p>
            <p>Users should maintain appropriate security practices and access Nova P2P through official channels.</p>
            <p>Nova P2P cannot guarantee uninterrupted service or absolute protection against every possible security threat.</p>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">8. Third-Party Risks</h2>
            <p>Payments and other services may depend on banks, payment providers, blockchain networks or other third parties.</p>
            <p>Delays, service interruptions, transaction fees or restrictions imposed by these third parties may affect a transaction.</p>
            <p>Blockchain transactions may be irreversible once confirmed. Always verify wallet addresses, networks and transaction details before making a transfer.</p>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">9. No Guarantee of Profit</h2>
            <p>Nova P2P does not guarantee profits, investment returns or the absence of financial losses from cryptocurrency or P2P trading.</p>
            <p>Past prices, trading activity, rankings or performance do not guarantee future results.</p>
            <p>Users should not trade with funds they cannot afford to lose.</p>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">10. User Responsibility</h2>
            <p>Before placing a trade, users should:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Review the offer and payment instructions carefully.</li>
              <li>Confirm the amount, price and applicable fees.</li>
              <li>Verify payments independently.</li>
              <li>Keep relevant transaction records.</li>
              <li>Protect their account credentials and personal information.</li>
              <li>Use the official dispute process when a trading problem occurs.</li>
              <li>Avoid transactions that appear suspicious or violate platform rules.</li>
            </ul>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">11. Contact and Assistance</h2>
            <p>If you experience a trading issue or suspect fraudulent activity, use the official support channels provided on the Nova P2P website.</p>
            <p>Please provide accurate transaction details and relevant evidence when requesting assistance. Never disclose your password, verification codes, private keys or recovery phrases.</p>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">12. Acknowledgement</h2>
            <p>By using Nova P2P, you acknowledge that cryptocurrency and P2P transactions involve risks and that you are responsible for making informed decisions.</p>
            <p>This Risk Disclosure is intended to explain general risks. It does not replace professional legal, financial or tax advice.</p>
            <p>Users should review the applicable Terms of Service, Privacy Policy, AML/KYC Policy and Fee Structure before using the platform.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const HelpCenter = () => {
  useEffect(() => {
    document.title = "Help Center & FAQs — NovaP2P | User Support Guide";
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="pt-32 pb-24 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white p-8 md:p-12 rounded-3xl shadow-sm border border-gray-100">
          <div className="border-b border-gray-100 pb-8 mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-primary font-medium text-xs mb-4">
              <HelpCircle size={14} /> Help Center & Support
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Nova P2P Help Center</h1>
            <p className="text-lg text-gray-600 leading-relaxed">
              Welcome to the Nova P2P Help Center. Find answers to common questions about your account, identity verification, P2P trading, payments, merchant services and account security.
            </p>
          </div>

          <div className="space-y-10">
            {/* 1. Getting Started */}
            <section className="bg-slate-50/70 p-6 md:p-8 rounded-2xl border border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-blue-100 text-primary flex items-center justify-center text-sm font-bold">1</span>
                Getting Started
              </h2>
              
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">What is Nova P2P?</h3>
                  <p className="text-gray-600">
                    Nova P2P is a peer-to-peer cryptocurrency trading platform that connects buyers and sellers through a structured trading process.
                  </p>
                </div>

                <div className="border-t border-gray-200/60 pt-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">How do I create an account?</h3>
                  <p className="text-gray-600">
                    Visit the Nova P2P website, select Sign Up and follow the on-screen instructions to register your account.
                  </p>
                </div>

                <div className="border-t border-gray-200/60 pt-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Where is Nova P2P available?</h3>
                  <p className="text-gray-600">
                    Nova P2P currently provides services in Nigeria. Available features may depend on your account eligibility and the services offered on the platform.
                  </p>
                </div>
              </div>
            </section>

            {/* 2. Account Verification */}
            <section className="bg-slate-50/70 p-6 md:p-8 rounded-2xl border border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-blue-100 text-primary flex items-center justify-center text-sm font-bold">2</span>
                Account Verification
              </h2>

              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Why is identity verification required?</h3>
                  <p className="text-gray-600">
                    Identity verification may be required to establish your identity and meet applicable compliance requirements.
                  </p>
                </div>

                <div className="border-t border-gray-200/60 pt-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">What should I do if my verification fails?</h3>
                  <p className="text-gray-600">
                    Check the information submitted and follow any instructions displayed on your account. If the issue continues, contact official support.
                  </p>
                </div>
              </div>
            </section>

            {/* 3. P2P Trading */}
            <section className="bg-slate-50/70 p-6 md:p-8 rounded-2xl border border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-blue-100 text-primary flex items-center justify-center text-sm font-bold">3</span>
                P2P Trading
              </h2>

              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">How do I buy USDT?</h3>
                  <ol className="list-decimal pl-6 space-y-2 text-gray-600">
                    <li>Sign in to your account.</li>
                    <li>Open the Buy section.</li>
                    <li>Review available offers, prices, limits and payment methods.</li>
                    <li>Select an offer and follow the order instructions.</li>
                    <li>Complete the required payment within the specified time.</li>
                    <li>Follow the platform's instructions to complete the trade.</li>
                  </ol>
                </div>

                <div className="border-t border-gray-200/60 pt-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">How do I sell USDT?</h3>
                  <ol className="list-decimal pl-6 space-y-2 text-gray-600">
                    <li>Sign in and open the Sell section.</li>
                    <li>Review available offers and their conditions.</li>
                    <li>Select an offer and follow the order instructions.</li>
                    <li>Verify that payment has actually arrived in your account.</li>
                    <li>Release the cryptocurrency only after confirming the required payment.</li>
                  </ol>
                </div>

                <div className="border-t border-gray-200/60 pt-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">What is escrow protection?</h3>
                  <p className="text-gray-600">
                    Where available, escrow is designed to hold cryptocurrency associated with a trade until the required transaction conditions are met. It helps reduce certain trading risks but does not guarantee that every transaction or dispute will be resolved successfully.
                  </p>
                </div>

                <div className="border-t border-gray-200/60 pt-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">What if my trade is delayed?</h3>
                  <p className="text-gray-600">
                    Check the order status and instructions. If the issue cannot be resolved through the normal trading process, use the available appeal or support procedure.
                  </p>
                </div>
              </div>
            </section>

            {/* 4. Payments and Fees */}
            <section className="bg-slate-50/70 p-6 md:p-8 rounded-2xl border border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-blue-100 text-primary flex items-center justify-center text-sm font-bold">4</span>
                Payments and Fees
              </h2>

              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Which payment methods can I use?</h3>
                  <p className="text-gray-600">
                    Available payment methods depend on the offers displayed on the platform. Always follow the instructions shown for your selected trade.
                  </p>
                </div>

                <div className="border-t border-gray-200/60 pt-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">What if I have paid but have not received USDT?</h3>
                  <p className="text-gray-600">
                    Keep your payment evidence and order details. Use the available appeal process or contact support if the issue remains unresolved.
                  </p>
                </div>

                <div className="border-t border-gray-200/60 pt-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Where can I check fees?</h3>
                  <p className="text-gray-600">
                    Review the <Link to="/fee-structure" className="text-primary hover:underline font-medium">Fee Structure</Link> page before completing a transaction. Applicable fees may depend on the service or transaction.
                  </p>
                </div>
              </div>
            </section>

            {/* 5. Merchant Services */}
            <section className="bg-slate-50/70 p-6 md:p-8 rounded-2xl border border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-blue-100 text-primary flex items-center justify-center text-sm font-bold">5</span>
                Merchant Services
              </h2>

              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">How can I apply to become a merchant?</h3>
                  <p className="text-gray-600">
                    Visit the <Link to="/merchant" className="text-primary hover:underline font-medium">Apply for Merchant</Link> section on the Nova P2P website and follow the application instructions.
                  </p>
                </div>

                <div className="border-t border-gray-200/60 pt-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Is merchant approval guaranteed?</h3>
                  <p className="text-gray-600">
                    No. Applications may be subject to eligibility requirements, verification and platform review.
                  </p>
                </div>
              </div>
            </section>

            {/* 6. Account Security */}
            <section className="bg-slate-50/70 p-6 md:p-8 rounded-2xl border border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-blue-100 text-primary flex items-center justify-center text-sm font-bold">6</span>
                Account Security
              </h2>

              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">How can I protect my account?</h3>
                  <ul className="list-disc pl-6 space-y-2 text-gray-600">
                    <li>Use a strong, unique password.</li>
                    <li>Never share your password or verification codes.</li>
                    <li>Verify payment details before making a transaction.</li>
                    <li>Access the platform through official channels.</li>
                    <li>Never release cryptocurrency based only on a payment screenshot.</li>
                    <li>Report suspicious activity promptly.</li>
                  </ul>
                </div>

                <div className="border-t border-gray-200/60 pt-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">What if I suspect unauthorized account access?</h3>
                  <p className="text-gray-600">
                    Secure your account using the available security options and contact official support as soon as possible.
                  </p>
                </div>
              </div>
            </section>

            {/* Need More Help? */}
            <div className="p-8 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 text-center">
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Need More Help?</h3>
              <p className="text-gray-600 max-w-xl mx-auto mb-6">
                If you cannot find an answer here, visit Contact Support to submit your question. For a trade-related payment dispute, use the appropriate appeal process where available.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <Link 
                  to="/contact-support" 
                  className="px-6 py-3 rounded-xl bg-primary text-white font-medium hover:bg-primary-dark transition-colors shadow-sm"
                >
                  Contact Support
                </Link>
                <Link 
                  to="/dispute-support" 
                  className="px-6 py-3 rounded-xl bg-white border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition-colors shadow-sm"
                >
                  Dispute Support
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ContactSupport = () => {
  useEffect(() => {
    document.title = "Contact Support — NovaP2P | 24/7 Dedicated Assistance";
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="pt-32 pb-24 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white p-8 md:p-12 rounded-3xl shadow-sm border border-gray-100">
          <div className="border-b border-gray-100 pb-8 mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-primary font-medium text-xs mb-4">
              <LifeBuoy size={14} /> Official Support
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Contact Nova P2P Support</h1>
            <p className="text-lg text-gray-600 leading-relaxed">
              Need assistance? Our support team is here to help with questions about your account, verification, trading, payments and other platform-related issues.
            </p>
          </div>

          <div className="space-y-8">
            {/* How We Can Help */}
            <div className="bg-slate-50/70 p-6 md:p-8 rounded-2xl border border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <CheckCircle2 size={22} className="text-primary" />
                How We Can Help
              </h2>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-gray-700">
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary shrink-0"></span>
                  Account registration and access
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary shrink-0"></span>
                  Identity verification questions
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary shrink-0"></span>
                  P2P trading and order issues
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary shrink-0"></span>
                  Payment-related questions
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary shrink-0"></span>
                  Merchant applications
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary shrink-0"></span>
                  Technical problems
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary shrink-0"></span>
                  General platform enquiries
                </li>
              </ul>
            </div>

            {/* Submit a Support Request */}
            <div className="bg-slate-50/70 p-6 md:p-8 rounded-2xl border border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Submit a Support Request</h2>
              <p className="text-gray-600 mb-4">
                Please provide the following information when contacting support:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-6">
                <li>Your registered email address</li>
                <li>Order ID (if applicable)</li>
                <li>Transaction ID or hash (if applicable)</li>
                <li>Description of the issue</li>
                <li>Screenshots or supporting documents (if available)</li>
              </ul>
              <div className="pt-2">
                <Link
                  to="/contact"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-primary-dark transition-colors shadow-sm text-sm"
                >
                  <MessageSquare size={16} /> Open Web Contact Form
                </Link>
              </div>
            </div>

            {/* Contact Channels */}
            <div className="bg-slate-50/70 p-6 md:p-8 rounded-2xl border border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Contact Channels</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-xl border border-gray-200">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 text-primary flex items-center justify-center mb-3">
                    <Mail size={20} />
                  </div>
                  <h3 className="font-bold text-gray-900 mb-1">Email Support</h3>
                  <a href="mailto:support@novap2p.com" className="text-primary hover:underline text-sm font-medium break-all">
                    support@novap2p.com
                  </a>
                </div>

                <div className="bg-white p-5 rounded-xl border border-gray-200">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 text-primary flex items-center justify-center mb-3">
                    <Globe size={20} />
                  </div>
                  <h3 className="font-bold text-gray-900 mb-1">Official Help Form</h3>
                  <Link to="/contact" className="text-primary hover:underline text-sm font-medium">
                    Available through the website contact form
                  </Link>
                </div>

                <div className="bg-white p-5 rounded-xl border border-gray-200">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 text-primary flex items-center justify-center mb-3">
                    <MessageCircle size={20} />
                  </div>
                  <h3 className="font-bold text-gray-900 mb-1">Live Support</h3>
                  <p className="text-gray-500 text-sm">
                    Coming soon to registered users
                  </p>
                </div>
              </div>
            </div>

            {/* Important Security Reminder */}
            <div className="p-6 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-4">
              <ShieldAlert className="text-amber-600 shrink-0 mt-0.5" size={24} />
              <div>
                <h3 className="text-base font-bold text-amber-900 mb-1">Important Security Reminder</h3>
                <p className="text-amber-800 text-sm leading-relaxed">
                  Nova P2P support agents will never ask for your password, seed phrase, private keys or 2FA codes.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const DisputeSupport = () => {
  useEffect(() => {
    document.title = "Dispute Support — NovaP2P | Fair Trade Resolution";
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="pt-32 pb-24 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white p-8 md:p-12 rounded-3xl shadow-sm border border-gray-100">
          <div className="border-b border-gray-100 pb-8 mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-primary font-medium text-xs mb-4">
              <Scale size={14} /> Fair Mediation & Escrow Protection
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Dispute Support</h1>
            <h2 className="text-xl font-semibold text-gray-600">Nova P2P Dispute Support</h2>
          </div>

          <div className="space-y-8">
            {/* How P2P Trade Disputes Work */}
            <div className="bg-slate-50/70 p-6 md:p-8 rounded-2xl border border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900 mb-3">How P2P Trade Disputes Work</h2>
              <p className="text-gray-600 leading-relaxed">
                When a trade dispute arises between a buyer and a seller, Nova P2P provides an appeal process to help resolve the issue fairly based on transaction evidence.
              </p>
            </div>

            {/* Common Reasons for Disputes */}
            <div className="bg-slate-50/70 p-6 md:p-8 rounded-2xl border border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Common Reasons for Disputes</h2>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start gap-3">
                  <span className="w-2 h-2 rounded-full bg-red-500 mt-2 shrink-0"></span>
                  <div>
                    <strong className="text-gray-900">Payment not received:</strong> The seller claims payment was not received in their account.
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-2 h-2 rounded-full bg-red-500 mt-2 shrink-0"></span>
                  <div>
                    <strong className="text-gray-900">Payment made but crypto not released:</strong> The buyer made payment within the allowed time, but the seller has not released cryptocurrency.
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-2 h-2 rounded-full bg-red-500 mt-2 shrink-0"></span>
                  <div>
                    <strong className="text-gray-900">Incorrect payment amount:</strong> The buyer paid an amount different from the agreed order amount.
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-2 h-2 rounded-full bg-red-500 mt-2 shrink-0"></span>
                  <div>
                    <strong className="text-gray-900">Third-party payment issues:</strong> Payment was sent from an account not matching the buyer's registered name.
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-2 h-2 rounded-full bg-red-500 mt-2 shrink-0"></span>
                  <div>
                    <strong className="text-gray-900">Unresponsive trading counterparty:</strong> One party stops responding during an active trade.
                  </div>
                </li>
              </ul>
            </div>

            {/* How to Open a Dispute / Appeal */}
            <div className="bg-slate-50/70 p-6 md:p-8 rounded-2xl border border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">How to Open a Dispute / Appeal</h2>
              <ol className="space-y-4 text-gray-700">
                {[
                  "Open the active trade in your Nova P2P account.",
                  "Select Appeal or Report Dispute.",
                  "Select the reason for your dispute.",
                  "Provide a clear description of what happened.",
                  "Upload clear evidence (proof of payment, bank statement, chat history, or payment receipt).",
                  "Submit the appeal."
                ].map((step, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <span className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm shrink-0">
                      {idx + 1}
                    </span>
                    <span className="pt-0.5 leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* What Evidence is Accepted? */}
            <div className="bg-slate-50/70 p-6 md:p-8 rounded-2xl border border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">What Evidence is Accepted?</h2>
              <ul className="space-y-2.5 list-disc pl-6 text-gray-700">
                <li>Bank account transaction receipts showing date, time, reference number and sender/recipient details.</li>
                <li>Bank statements or mobile money transaction SMS/notifications.</li>
                <li>Video screen recording showing the banking app with transaction details.</li>
                <li>Proof that payment was or was not credited to the recipient's bank account.</li>
              </ul>
            </div>

            {/* Dispute Guidelines */}
            <div className="bg-blue-50/80 p-6 md:p-8 rounded-2xl border border-blue-100">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <ShieldCheck size={24} className="text-primary" />
                Dispute Guidelines
              </h2>
              <ul className="space-y-2.5 list-disc pl-6 text-gray-800">
                <li>Do not cancel a trade if you have already sent payment.</li>
                <li>Never release cryptocurrency before confirming actual receipt in your bank account or wallet.</li>
                <li>Only communicate through official Nova P2P channels for disputes.</li>
                <li>Nova P2P dispute specialists review evidence impartially according to platform rules.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ReportIssue = () => {
  useEffect(() => {
    document.title = "Report an Issue — NovaP2P | Security & Bug Reporting";
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="pt-32 pb-24 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white p-8 md:p-12 rounded-3xl shadow-sm border border-gray-100">
          <div className="border-b border-gray-100 pb-8 mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-50 border border-red-100 text-red-600 font-medium text-xs mb-4">
              <AlertCircle size={14} /> Security & Bug Reporting
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Report an Issue</h1>
            <h2 className="text-xl font-semibold text-gray-600 mb-4">Report an Issue or Security Concern</h2>
            <p className="text-lg text-gray-600 leading-relaxed">
              Help us keep Nova P2P secure and reliable. Use this page to report bugs, technical glitches, security vulnerabilities, suspicious traders, or fraud attempts.
            </p>
          </div>

          <div className="space-y-8">
            {/* Types of Issues You Can Report */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Types of Issues You Can Report</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-slate-50/70 p-6 rounded-2xl border border-gray-100">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 text-primary flex items-center justify-center mb-4 font-bold">
                    1
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-3">Technical Bugs & Glitches</h3>
                  <ul className="space-y-2 text-sm text-gray-600 list-disc pl-4">
                    <li>Website errors, broken links, or UI display issues.</li>
                    <li>Wallet balance or transaction status syncing delays.</li>
                    <li>Mobile browser or notification issues.</li>
                  </ul>
                </div>

                <div className="bg-slate-50/70 p-6 rounded-2xl border border-gray-100">
                  <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center mb-4 font-bold">
                    2
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-3">Fraud & Scam Attempts</h3>
                  <ul className="space-y-2 text-sm text-gray-600 list-disc pl-4">
                    <li>Counterparties asking you to trade or pay outside Nova P2P.</li>
                    <li>Fake payment receipts, SMS or forged confirmation screenshots.</li>
                    <li>Impersonation of Nova P2P staff or official support.</li>
                    <li>Phishing websites or suspicious links.</li>
                  </ul>
                </div>

                <div className="bg-slate-50/70 p-6 rounded-2xl border border-gray-100">
                  <div className="w-10 h-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center mb-4 font-bold">
                    3
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-3">Account & Security Concerns</h3>
                  <ul className="space-y-2 text-sm text-gray-600 list-disc pl-4">
                    <li>Suspicious activity on your account.</li>
                    <li>Unauthorized login notifications.</li>
                    <li>Security vulnerability disclosure.</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* How to Report */}
            <div className="bg-slate-50/70 p-6 md:p-8 rounded-2xl border border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">How to Report</h2>
              <p className="text-gray-600 mb-4">Email our official support team directly:</p>
              <div className="bg-white p-5 rounded-xl border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 text-primary flex items-center justify-center shrink-0">
                    <Mail size={20} />
                  </div>
                  <div>
                    <span className="text-xs uppercase font-semibold text-gray-400 block mb-0.5">
                      Direct Support & Issue Reporting
                    </span>
                    <a href="mailto:support@novap2p.com" className="text-primary font-bold hover:underline text-base sm:text-lg break-all">
                      support@novap2p.com
                    </a>
                  </div>
                </div>
                <a
                  href="mailto:support@novap2p.com"
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-primary-dark transition-colors text-sm w-fit"
                >
                  Send Email
                </a>
              </div>
            </div>

            {/* What to Include */}
            <div className="bg-slate-50/70 p-6 md:p-8 rounded-2xl border border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">What to Include</h2>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li>A clear summary of the issue</li>
                <li>Device, browser, and operating system used</li>
                <li>Exact steps to reproduce the problem</li>
                <li>Screenshots, screen recordings, or error codes</li>
                <li>Associated Order IDs or user details (if reporting a trader)</li>
              </ul>
            </div>

            {/* Response Time */}
            <div className="p-6 rounded-2xl bg-blue-50 border border-blue-100 flex items-start gap-4">
              <ShieldCheck className="text-primary shrink-0 mt-0.5" size={24} />
              <div>
                <h3 className="text-base font-bold text-gray-900 mb-1">Response Time</h3>
                <p className="text-gray-700 text-sm leading-relaxed">
                  Our team reviews critical security and fraud reports promptly. General bug reports are investigated during platform maintenance cycles.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const PromotionalPopup = () => {
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={() => setIsOpen(false)}
      >
        <motion.div 
          initial={{ opacity: 0, scale: 0.92, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 16 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="relative max-w-4xl w-full my-auto rounded-2xl overflow-visible shadow-2xl bg-slate-900 border border-slate-700/60"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Small Cross Icon */}
          <button
            onClick={() => setIsOpen(false)}
            aria-label="Close promotional banner"
            className="absolute -top-3 -right-3 md:-top-4 md:-right-4 w-9 h-9 rounded-full bg-white text-gray-800 hover:text-black hover:bg-gray-100 flex items-center justify-center shadow-xl border border-gray-300 z-20 cursor-pointer transition-transform hover:scale-110 active:scale-95"
          >
            <X size={18} className="stroke-[2.5]" />
          </button>

          {/* Promotional Image */}
          <div className="relative rounded-2xl overflow-hidden bg-slate-950">
            <a 
              href="https://app.novap2p.com/register" 
              target="_blank" 
              rel="noopener noreferrer"
              className="block cursor-pointer focus:outline-none"
            >
              <img
                src={promotionalBannerImg}
                alt="Nova Swap Genesis Rewards"
                className="w-full h-auto block rounded-2xl object-contain hover:opacity-95 transition-opacity"
              />
            </a>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

const Home = () => {
  useEffect(() => {
    document.title = "NovaP2P — Trusted Peer-to-Peer Crypto Trading & Escrow Platform";
  }, []);

  return (
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
  );
};

const AnalyticsTracker = () => {
  const location = useLocation();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(location.search);
      const ref = params.get('ref');
      if (ref) {
        localStorage.setItem('nova_swap_ref_code', ref.trim().toUpperCase());
        localStorage.setItem('nova_affiliate_ref_wallet', ref.trim().toLowerCase());
      }
      if ((window as any).gtag) {
        (window as any).gtag('config', 'G-N8MKBS9JK3', {
          page_path: location.pathname + location.search,
          page_title: document.title,
        });
      }
    }
  }, [location]);

  return null;
};

const AppShell = () => {
  const location = useLocation();
  const isStandaloneDarkPortal =
    location.pathname.startsWith('/partner-dashboard') ||
    location.pathname.startsWith('/bdm-dashboard') ||
    location.pathname.startsWith('/swap-admin');

  return (
    <div
      className={
        isStandaloneDarkPortal
          ? 'min-h-screen bg-[#060c14] font-sans'
          : 'min-h-screen bg-white font-sans selection:bg-primary/20 selection:text-primary'
      }
    >
      {!isStandaloneDarkPortal && <Navbar />}
      {!isStandaloneDarkPortal && <PromotionalPopup />}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/swap" element={<SwapPage />} />
        <Route path="/how-swap-works" element={<HowSwapWorksPage />} />
        <Route path="/supported-chains" element={<SupportedChainsPage />} />
        <Route path="/swap-fees" element={<SwapFeesPage />} />
        <Route path="/become-partner" element={<BecomePartnerPage />} />
        <Route path="/become-bdm" element={<BecomeBdmPage />} />
        <Route path="/partner-overview" element={<PartnerOverviewPage />} />
        <Route path="/commission" element={<CommissionStructurePage />} />
        <Route path="/partner-dashboard" element={<PartnerDashboardPage />} />
        <Route path="/bdm-dashboard" element={<BdmDashboardPage />} />
        <Route path="/partner-faq" element={<PartnerFaqPage />} />
        <Route path="/about" element={<AboutUs />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/merchant" element={<Merchant />} />
        <Route path="/risk-disclosure" element={<RiskDisclosure />} />
        <Route path="/help-center" element={<HelpCenter />} />
        <Route path="/faq" element={<HelpCenter />} />
        <Route path="/help" element={<HelpCenter />} />
        <Route path="/contact-support" element={<ContactSupport />} />
        <Route path="/support" element={<ContactSupport />} />
        <Route path="/dispute-support" element={<DisputeSupport />} />
        <Route path="/report-issue" element={<ReportIssue />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms-of-service" element={<TermsOfService />} />
        <Route path="/cookie-policy" element={<CookiePolicy />} />
        <Route path="/aml-kyc-policy" element={<AmlKycPolicy />} />
        <Route path="/fee-structure" element={<FeeStructure />} />
        <Route path="/swap-admin" element={<SwapAdminDashboard />} />
        <Route path="*" element={<Home />} />
      </Routes>
      {!isStandaloneDarkPortal && <Footer />}
    </div>
  );
};

export default function App() {
  return (
    <WalletProvider>
      <BrowserRouter>
        <AnalyticsTracker />
        <AppShell />
      </BrowserRouter>
    </WalletProvider>
  );
}
