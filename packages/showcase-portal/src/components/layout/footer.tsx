import Link from 'next/link';
import { FiGithub, FiTwitter, FiMail, FiExternalLink } from 'react-icons/fi';
import { FaDiscord } from 'react-icons/fa';

const footerLinks = {
  product: [
    { name: 'Features', href: '/features' },
    { name: 'Pricing', href: '/pricing' },
    { name: 'Discord Bot', href: 'https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID' },
    { name: 'API Docs', href: '/docs' },
  ],
  community: [
    { name: 'Discord Server', href: 'https://discord.gg/gamevibe' },
    { name: 'Twitter', href: 'https://twitter.com/gamevibe_ai' },
    { name: 'GitHub', href: 'https://github.com/gamevibe-ai' },
    { name: 'Blog', href: '/blog' },
  ],
  resources: [
    { name: 'Documentation', href: '/docs' },
    { name: 'Tutorials', href: '/tutorials' },
    { name: 'Changelog', href: '/changelog' },
    { name: 'Support', href: '/support' },
  ],
  company: [
    { name: 'About', href: '/about' },
    { name: 'Terms', href: '/terms' },
    { name: 'Privacy', href: '/privacy' },
    { name: 'Contact', href: '/contact' },
  ],
};

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-20 border-t border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      <div className="container py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:grid-cols-5">
          {/* Brand Column */}
          <div className="col-span-2 lg:col-span-1">
            <Link href="/" className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-brand p-1.5">
                <FiExternalLink className="h-full w-full text-white" />
              </div>
              <span className="font-display text-xl font-bold">GameVibe AI</span>
            </Link>
            <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
              Create amazing games with AI, right in Discord.
            </p>
            <div className="mt-6 flex gap-4">
              <a
                href="https://discord.gg/gamevibe"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-600 transition-colors hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400"
                aria-label="Discord"
              >
                <FaDiscord className="h-5 w-5" />
              </a>
              <a
                href="https://twitter.com/gamevibe_ai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-600 transition-colors hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400"
                aria-label="Twitter"
              >
                <FiTwitter className="h-5 w-5" />
              </a>
              <a
                href="https://github.com/gamevibe-ai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-600 transition-colors hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400"
                aria-label="GitHub"
              >
                <FiGithub className="h-5 w-5" />
              </a>
              <a
                href="mailto:hello@gamevibe.ai"
                className="text-gray-600 transition-colors hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400"
                aria-label="Email"
              >
                <FiMail className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Links Columns */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Product
            </h3>
            <ul className="mt-4 space-y-2">
              {footerLinks.product.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-600 transition-colors hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Community
            </h3>
            <ul className="mt-4 space-y-2">
              {footerLinks.community.map((link) => (
                <li key={link.name}>
                  <a
                    href={link.href}
                    target={link.href.startsWith('http') ? '_blank' : undefined}
                    rel={link.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                    className="text-sm text-gray-600 transition-colors hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400"
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Resources
            </h3>
            <ul className="mt-4 space-y-2">
              {footerLinks.resources.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-600 transition-colors hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Company
            </h3>
            <ul className="mt-4 space-y-2">
              {footerLinks.company.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-600 transition-colors hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-gray-200 pt-8 dark:border-gray-700 md:flex-row">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            © {currentYear} GameVibe AI. All rights reserved.
          </p>
          <div className="flex gap-6">
            <Link
              href="/terms"
              className="text-sm text-gray-600 transition-colors hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400"
            >
              Terms
            </Link>
            <Link
              href="/privacy"
              className="text-sm text-gray-600 transition-colors hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400"
            >
              Privacy
            </Link>
            <Link
              href="/cookies"
              className="text-sm text-gray-600 transition-colors hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400"
            >
              Cookies
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}