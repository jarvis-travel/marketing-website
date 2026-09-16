import { useEffect, useState } from 'react';
import { LogoLockup } from './Logo';
import { Link, matchPath, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

const NAV_LINKS: { name: string; path: string }[] = [
  { name: 'How it works', path: '/features' },
  { name: 'Pricing', path: '/pricing' },
  { name: 'About', path: '/about' },
  { name: 'Contact', path: '/contact' },
];

export function Navigation() {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isLightNav = location.pathname === '/' && !isScrolled;
  const currentPath = location.pathname;
  // Join Now goes to /pricing, whose plan cards carry their own, so there a nav
  // link to the page you're on would do nothing.
  const showJoinNow = !matchPath('/pricing', currentPath);

  return (
    <nav
      className={`fixed w-full top-0 z-50 transition-all duration-300 ${
        isScrolled || currentPath !== '/'
          ? 'bg-white/95 backdrop-blur-lg shadow-lg'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`flex justify-between items-center py-4 ${isLightNav ? 'focus-on-dark' : ''}`}>
          {/* The lockup is inlined so fill="currentColor" inherits the text colour
              here, which is how one file stays correct on both grounds. Colour
              follows the surface, never #fff: gray-50 is Moonlight, gray-900 is
              Neverything. No TM in the header (brand owner, 2026-08-02): the
              footer copyright line carries it, which is the conventional place
              for it and keeps the lockup clean. */}
          <Link
            to="/"
            aria-label="JarvisTravel home"
            className={`flex items-center ${
              isLightNav ? 'text-gray-50' : 'text-gray-900'
            }`}
          >
            <LogoLockup className="h-16 w-auto" title={null} />
          </Link>

          <div className="hidden md:flex items-center space-x-8">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`font-medium transition-all relative ${
                  currentPath === link.path
                    ? 'text-sky-500'
                    : isLightNav
                      ? 'text-gray-50/90 hover:text-gray-50'
                      : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {link.name}
                {currentPath === link.path && (
                  <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-sky-500" />
                )}
              </Link>
            ))}

            {showJoinNow && (
              <Link
                to="/pricing"
                className="px-5 py-2.5 bg-amber-400 text-gray-900 rounded-sm font-medium hover:bg-amber-300 transition-colors"
              >
                Join Now
              </Link>
            )}
          </div>

          <button
            type="button"
            aria-label="Menu"
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-menu"
            onClick={() => setIsMobileMenuOpen((open) => !open)}
            className={`md:hidden p-2 rounded-lg ${
              isLightNav ? 'text-gray-50' : 'text-gray-900'
            }`}
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {isMobileMenuOpen && (
          <div id="mobile-menu" className="md:hidden bg-white rounded-2xl shadow-xl p-4 mb-4 animate-in slide-in-from-top-2">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`block w-full text-left py-3 px-4 rounded-xl font-medium transition-colors ${
                  currentPath === link.path
                    ? 'bg-sky-50 text-sky-600'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {link.name}
              </Link>
            ))}
            {showJoinNow && (
              <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                <Link
                  to="/pricing"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="w-full py-3 bg-amber-400 text-gray-900 rounded-sm font-medium block text-center"
                >
                  Join Now
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
