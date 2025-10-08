import React, { ReactNode } from "react";
import { SkipLink } from "./KeyboardNavigation";
import { ToastProvider } from "./AccessibleToast";

interface LayoutProps {
  children: ReactNode;
  title?: string;
  description?: string;
}

const Layout: React.FC<LayoutProps> = ({ 
  children, 
  title = "CPS Store",
  description = "Village shopkeeper e-commerce platform"
}) => {
  return (
    <ToastProvider>
      <div className="min-h-screen bg-secondary-50">
        {/* Skip Links for Accessibility */}
        <SkipLink href="#main-content">
          Skip to main content
        </SkipLink>
        <SkipLink href="#navigation">
          Skip to navigation
        </SkipLink>
        
        {/* Document Head */}
        <head>
          <title>{title}</title>
          <meta name="description" content={description} />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="theme-color" content="#0ea5e9" />
        </head>

        {/* Main Layout */}
        <div className="flex flex-col min-h-screen">
          {/* Header */}
          <header 
            id="navigation"
            className="bg-white shadow-sm border-b border-secondary-200 z-sticky"
            role="banner"
          >
            <div className="container">
              <div className="flex items-center justify-between h-16">
                <div className="flex items-center">
                  <h1 className="text-xl font-bold text-primary-600">
                    CPS Store
                  </h1>
                </div>
                <nav className="hidden md:flex space-x-8" role="navigation" aria-label="Main navigation">
                  <a href="/" className="nav-link">Home</a>
                  <a href="/products" className="nav-link">Products</a>
                  <a href="/orders" className="nav-link">Orders</a>
                  <a href="/profile" className="nav-link">Profile</a>
                </nav>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main 
            id="main-content"
            className="flex-1 z-base"
            role="main"
            tabIndex={-1}
          >
            {children}
          </main>

          {/* Footer */}
          <footer 
            className="bg-white border-t border-secondary-200 z-base"
            role="contentinfo"
          >
            <div className="container py-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div>
                  <h3 className="text-lg font-semibold text-secondary-900 mb-4">
                    CPS Store
                  </h3>
                  <p className="text-secondary-600 text-sm">
                    Empowering village shopkeepers with modern e-commerce solutions.
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-secondary-900 mb-4">
                    Quick Links
                  </h4>
                  <ul className="space-y-2">
                    <li><a href="/products" className="text-sm text-secondary-600 hover:text-primary-600">Products</a></li>
                    <li><a href="/orders" className="text-sm text-secondary-600 hover:text-primary-600">Orders</a></li>
                    <li><a href="/support" className="text-sm text-secondary-600 hover:text-primary-600">Support</a></li>
                  </ul>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-secondary-900 mb-4">
                    Contact
                  </h4>
                  <p className="text-sm text-secondary-600">
                    Phone: +91 9876543210<br />
                    Email: support@cpsstore.com
                  </p>
                </div>
              </div>
              <div className="border-t border-secondary-200 mt-8 pt-8 text-center">
                <p className="text-sm text-secondary-500">
                  © 2024 CPS Store. All rights reserved.
                </p>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </ToastProvider>
  );
};

export default Layout;
