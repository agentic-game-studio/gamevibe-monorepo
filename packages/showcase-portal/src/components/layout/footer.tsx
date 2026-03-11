import Link from 'next/link';
import { FiGithub, FiTwitter, FiMail, FiExternalLink, FiZap, FiUsers, FiBook, FiMap, FiCreditCard, FiFileText, FiHelpCircle } from 'react-icons/fi';
import { FaDiscord, FaGamepad } from 'react-icons/fa';

const footerLinks = {
  product: [
    { name: 'Features', href: '/features', icon: FiZap },
    { name: 'Pricing', href: '/pricing', icon: FiCreditCard },
    { name: 'Discord Bot', href: 'https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID', icon: FaDiscord },
    { name: 'API Docs', href: '/docs', icon: FiBook },
  ],
  community: [
    { name: 'Discord Server', href: 'https://discord.gg/gamevibe', icon: FaDiscord },
    { name: 'Twitter', href: 'https://twitter.com/gamevibe_ai', icon: FiTwitter },
    { name: 'GitHub', href: 'https://github.com/gamevibe-ai', icon: FiGithub },
    { name: 'Blog', href: '/blog', icon: FiFileText },
  ],
  resources: [
    { name: 'Documentation', href: '/docs', icon: FiBook },
    { name: 'Tutorials', href: '/tutorials', icon: FaGamepad },
    { name: 'Changelog', href: '/changelog', icon: FiZap },
    { name: 'Support', href: '/support', icon: FiHelpCircle },
  ],
  company: [
    { name: 'About', href: '/about', icon: FiMap },
    { name: 'Terms', href: '/terms', icon: FiFileText },
    { name: 'Privacy', href: '/privacy', icon: FiFileText },
    { name: 'Contact', href: '/contact', icon: FiMail },
  ],
};

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-[#5c4410] bg-gradient-to-b from-[#1a1425] to-[#0d0a12]">
      <div className="container py-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:grid-cols-5">
          {/* Brand Column */}
          <div className="col-span-2 lg:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="relative h-9 w-9 group-hover:scale-105 transition-transform flex-shrink-0">
                <svg
                  viewBox="0 0 36 36"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-full h-full"
                >
                  <defs>
                    <linearGradient id="logoGradientFooter" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#ff6b35" />
                      <stop offset="100%" stopColor="#f7c548" />
                    </linearGradient>
                  </defs>
                  <circle cx="18" cy="18" r="16" fill="url(#logoGradientFooter)" />
                  <path
                    d="M12 24V12L18 8L24 12V24L18 28L12 24Z"
                    fill="#1a1425"
                    stroke="#1a1425"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                  <circle cx="18" cy="18" r="3" fill="url(#logoGradientFooter)" />
                </svg>
              </div>
              <span className="text-lg font-bold gold-accent">
                GameVibe
              </span>
            </Link>
            <p className="mt-4 text-sm text-[#a89585] max-w-xs">
              Create amazing games with AI, right in Discord. No coding required.
            </p>
            <div className="mt-6 flex gap-4">
              <a
                href="https://discord.gg/gamevibe"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#a89585] hover:text-[#ffd700] transition-colors"
                aria-label="Discord"
              >
                <FaDiscord className="h-5 w-5" />
              </a>
              <a
                href="https://twitter.com/gamevibe_ai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#a89585] hover:text-[#ffd700] transition-colors"
                aria-label="Twitter"
              >
                <FiTwitter className="h-5 w-5" />
              </a>
              <a
                href="https://github.com/gamevibe-ai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#a89585] hover:text-[#ffd700] transition-colors"
                aria-label="GitHub"
              >
                <FiGithub className="h-5 w-5" />
              </a>
              <a
                href="mailto:hello@gamevibe.ai"
                className="text-[#a89585] hover:text-[#ffd700] transition-colors"
                aria-label="Email"
              >
                <FiMail className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Links Columns */}
          <div>
            <h3 className="text-sm font-semibold text-white">
              Product
            </h3>
            <ul className="mt-4 space-y-2.5">
              {footerLinks.product.map((link) => {
                const Icon = link.icon;
                return (
                  <li key={link.name}>
                    <a
                      href={link.href}
                      target={link.href.startsWith('http') ? '_blank' : undefined}
                      rel={link.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                      className="text-sm text-[#a89585] hover:text-[#ffd700] transition-colors flex items-center gap-2"
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {link.name}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white">
              Community
            </h3>
            <ul className="mt-4 space-y-2.5">
              {footerLinks.community.map((link) => {
                const Icon = link.icon;
                return (
                  <li key={link.name}>
                    <a
                      href={link.href}
                      target={link.href.startsWith('http') ? '_blank' : undefined}
                      rel={link.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                      className="text-sm text-[#a89585] hover:text-[#ffd700] transition-colors flex items-center gap-2"
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {link.name}
                      {link.href.startsWith('http') && (
                        <FiExternalLink className="h-3 w-3 opacity-50" />
                      )}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white">
              Resources
            </h3>
            <ul className="mt-4 space-y-2.5">
              {footerLinks.resources.map((link) => {
                const Icon = link.icon;
                return (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="text-sm text-[#a89585] hover:text-[#ffd700] transition-colors flex items-center gap-2"
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {link.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white">
              Company
            </h3>
            <ul className="mt-4 space-y-2.5">
              {footerLinks.company.map((link) => {
                const Icon = link.icon;
                return (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="text-sm text-[#a89585] hover:text-[#ffd700] transition-colors flex items-center gap-2"
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {link.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-[#5c4410]/50 pt-8 md:flex-row">
          <p className="text-sm text-[#a89585]">
            © {currentYear} GameVibe AI. All rights reserved.
          </p>
          <div className="flex gap-6">
            <Link
              href="/terms"
              className="text-sm text-[#a89585] hover:text-[#ffd700] transition-colors"
            >
              Terms
            </Link>
            <Link
              href="/privacy"
              className="text-sm text-[#a89585] hover:text-[#ffd700] transition-colors"
            >
              Privacy
            </Link>
            <Link
              href="/cookies"
              className="text-sm text-[#a89585] hover:text-[#ffd700] transition-colors"
            >
              Cookies
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
