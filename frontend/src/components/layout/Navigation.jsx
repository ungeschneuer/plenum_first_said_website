import { Link } from 'react-router-dom';
import { Moon, Sun, Menu, ChevronDown, Users, Building2, Calendar } from 'lucide-react';
import { useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { Button } from '../ui/button';
import { Sheet, SheetContent, SheetTrigger } from '../ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

export function Navigation() {
  const { theme, toggleTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const mainNavLinks = [
    { to: '/wort-des-tages', label: 'Wort des Tages' },
    { to: '/vergleich', label: 'Wortvergleich' },
  ];

  const datenNavLinks = [
    { to: '/redner', label: 'Redner/innen', icon: Users },
    { to: '/parteien', label: 'Parteien', icon: Building2 },
    { to: '/wahlperioden', label: 'Wahlperioden', icon: Calendar },
  ];

  return (
    <nav
      className="sticky top-0 z-50 bg-background border-b border-border backdrop-blur-sm bg-opacity-95 dark:bg-opacity-95"
      aria-label="Hauptnavigation"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <div className="text-xl font-bold">
              Bundestag <span className="text-secondary">Wortschatz</span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            {mainNavLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {link.label}
              </Link>
            ))}

            {/* Daten Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors h-auto p-0 gap-1"
                  aria-label="Daten-Menü öffnen"
                >
                  Daten
                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-background/100 backdrop-blur-none">
                {datenNavLinks.map((link) => {
                  const Icon = link.icon;
                  return (
                    <DropdownMenuItem key={link.to} asChild>
                      <Link
                        to={link.to}
                        className="flex items-center gap-2 w-full cursor-pointer"
                      >
                        <Icon className="h-4 w-4" aria-hidden="true" />
                        {link.label}
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Theme Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="h-9 w-9"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? (
                <Moon className="h-5 w-5" />
              ) : (
                <Sun className="h-5 w-5" />
              )}
            </Button>
          </div>

          {/* Mobile Navigation */}
          <div className="flex md:hidden items-center gap-2">
            {/* Mobile Theme Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="h-9 w-9"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? (
                <Moon className="h-5 w-5" />
              ) : (
                <Sun className="h-5 w-5" />
              )}
            </Button>

            {/* Mobile Menu */}
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Menü öffnen">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Menü öffnen</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[240px] sm:w-[300px]">
                <div className="flex flex-col gap-4 mt-8">
                  <Link to="/" className="text-lg font-bold mb-4" onClick={() => setIsOpen(false)}>
                    Bundestag <span className="text-secondary">Wortschatz</span>
                  </Link>

                  {/* Main Links */}
                  {mainNavLinks.map((link) => (
                    <Link
                      key={link.to}
                      to={link.to}
                      className="text-base font-medium text-foreground hover:text-secondary transition-colors py-2"
                      onClick={() => setIsOpen(false)}
                    >
                      {link.label}
                    </Link>
                  ))}

                  {/* Daten Section */}
                  <div className="border-t pt-4 mt-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      Daten
                    </p>
                    {datenNavLinks.map((link) => {
                      const Icon = link.icon;
                      return (
                        <Link
                          key={link.to}
                          to={link.to}
                          className="flex items-center gap-2 text-base font-medium text-foreground hover:text-secondary transition-colors py-2"
                          onClick={() => setIsOpen(false)}
                        >
                          <Icon className="h-4 w-4" aria-hidden="true" />
                          {link.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
}
