import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, User, MessageSquare, Send, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import emailjs from '@emailjs/browser';

export interface ContactFormProps {
  className?: string;
  source?: string; // e.g. 'General Contact', 'Merchant Inquiry', etc.
}

export const ContactForm: React.FC<ContactFormProps> = ({ className = '', source = 'General Contact' }) => {
  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  
  // Anti-spam Honey Pot field (should always remain empty for genuine users)
  const [honeypot, setHoneypot] = useState('');

  // Status management: 'idle' | 'loading' | 'success' | 'error'
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  // Loaded credentials from environment variables or safe fallbacks
  const env = (import.meta as any).env || {};
  const serviceId = env.VITE_EMAILJS_SERVICE_ID || 'service_vdt1rat';
  const templateId = env.VITE_EMAILJS_TEMPLATE_ID || 'template_k3vb6pp';
  const publicKey = env.VITE_EMAILJS_PUBLIC_KEY || '8J3X62oVWT-2HXcvw';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Basic Field Validation
    if (!name.trim() || !email.trim() || !message.trim()) {
      setStatus('error');
      setErrorMessage('Please fill in all the required fields.');
      return;
    }

    // 2. Email Validation Pattern
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setStatus('error');
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    // 3. Spambot Detection via Honeypot
    if (honeypot) {
      // Quietly consume and mock success to confuse bots
      setStatus('loading');
      setTimeout(() => {
        setStatus('success');
        setName('');
        setEmail('');
        setMessage('');
      }, 1500);
      return;
    }

    setStatus('loading');

    // 4. Send Email via EmailJS
    try {
      // Check if credentials exist. If not, fallback to developer guidance simulation.
      if (!serviceId || !templateId || !publicKey) {
        console.warn(
          "⚠️ EmailJS Credentials Missing. Running in Developer Simulation Mode.\n" +
          "Create a .env file with VITE_EMAILJS_SERVICE_ID, VITE_EMAILJS_TEMPLATE_ID, and VITE_EMAILJS_PUBLIC_KEY."
        );
        
        // Simulating the email request
        await new Promise((resolve) => setTimeout(resolve, 1500));
        setStatus('success');
        setName('');
        setEmail('');
        setMessage('');
        return;
      }

      // Template parameters matching your EmailJS configuration
      const templateParams = {
        from_name: name,
        from_email: email,
        message: message,
        subject: `Contact Form Submission (${source}) - NovaP2P`,
        form_source: source,
      };

      const result = await emailjs.send(
        serviceId,
        templateId,
        templateParams,
        publicKey
      );

      if (result.status === 200) {
        setStatus('success');
        setName('');
        setEmail('');
        setMessage('');
      } else {
        throw new Error(`EmailJS responded with text: ${result.text}`);
      }

    } catch (error: any) {
      console.error('EmailJS Send Failure:', error);
      setStatus('error');
      setErrorMessage(
        error?.text || 
        error?.message || 
        'An error occurred while sending your request. Please try again later or contact support@novap2p.com.'
      );
    }
  };

  return (
    <div className={`w-full max-w-2xl mx-auto bg-white p-8 md:p-12 rounded-3xl border border-gray-100 shadow-xl ${className}`}>
      
      {/* Honeypot field (hidden completely from humans) */}
      <div className="hidden aria-hidden:true">
        <input 
          type="text" 
          name="website_honey" 
          value={honeypot} 
          onChange={(e) => setHoneypot(e.target.value)} 
          placeholder="Do not fill this if you are human"
          autoComplete="off"
          tabIndex={-1}
        />
      </div>

      <AnimatePresence mode="wait">
        {status === 'success' ? (
          <motion.div
            key="success-container"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="text-center py-8"
          >
            <div className="w-16 h-16 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-md border border-green-100">
              <CheckCircle2 size={32} />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">Message Sent Directly!</h3>
            <p className="text-gray-600 max-w-md mx-auto mb-6">
              Thank you for contacting NovaP2P. Your message has been received securely, and our team will get back to you via <strong className="text-gray-900">{email || 'your email'}</strong> as soon as possible.
            </p>
            <button
              onClick={() => setStatus('idle')}
              className="px-6 py-2.5 bg-blue-50 text-primary hover:bg-blue-105 rounded-xl font-medium transition-colors border border-blue-100"
            >
              Send Another Message
            </button>
          </motion.div>
        ) : (
          <motion.form
            key="form-container"
            onSubmit={handleSubmit}
            className="space-y-6"
            noValidate
          >
            {/* Status Feedback banner */}
            {status === 'error' && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-red-50 border border-red-100 text-red-700 rounded-2xl flex items-start gap-3"
              >
                <AlertCircle className="shrink-0 text-red-500 mt-0.5" size={18} />
                <div className="text-sm">
                  <span className="font-semibold">Unable to Send:</span> {errorMessage}
                </div>
              </motion.div>
            )}

            {/* EmailJS simulation banner */}
            {(!serviceId || !templateId || !publicKey) && (
              <div className="p-3 bg-amber-50 border border-amber-100 text-amber-800 rounded-xl text-xs flex items-center gap-2">
                <span className="inline-flex h-2 w-2 rounded-full bg-amber-500 animate-pulse"></span>
                <span><strong>Developer Notice:</strong> EmailJS configuration variables are not set. The form will run in simulation mode. Check the setup guide at the bottom of the page!</span>
              </div>
            )}

            <div className="grid grid-cols-1 gap-6">
              {/* Full Name field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                    <User size={18} />
                  </div>
                  <input
                    type="text"
                    required
                    disabled={status === 'loading'}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-gray-50/50 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary focus:border-primary focus:bg-white outline-none transition-all disabled:opacity-50"
                    placeholder="John Doe"
                  />
                </div>
              </div>

              {/* Email Address field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                    <Mail size={18} />
                  </div>
                  <input
                    type="email"
                    required
                    disabled={status === 'loading'}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-gray-50/50 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary focus:border-primary focus:bg-white outline-none transition-all disabled:opacity-50"
                    placeholder="john@example.com"
                  />
                </div>
              </div>

              {/* Message field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  How can we help you? <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute top-3.5 left-4 pointer-events-none text-gray-400">
                    <MessageSquare size={18} />
                  </div>
                  <textarea
                    required
                    disabled={status === 'loading'}
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-gray-50/50 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary focus:border-primary focus:bg-white outline-none transition-all resize-none disabled:opacity-50"
                    placeholder="Write your query or message here..."
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full h-14 bg-primary hover:bg-primary-dark disabled:bg-primary/75 text-white rounded-xl font-bold text-lg select-none flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer shadow-lg shadow-primary/20 hover:shadow-primary/30 active:scale-[0.99]"
            >
              {status === 'loading' ? (
                <>
                  <RefreshCw className="animate-spin" size={20} />
                  <span>Sending Message...</span>
                </>
              ) : (
                <>
                  <Send size={18} />
                  <span>Send Message</span>
                </>
              )}
            </button>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
};
