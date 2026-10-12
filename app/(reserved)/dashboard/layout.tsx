// app/(reserved)/dashboard/layout.tsx
"use client";

import React from "react";
import { NotificationsProvider } from "../../context/NotificationsContext";
import { PortfolioProvider } from "../../context/PortfolioContext";
import { ClientsProvider } from "../../context/ClientsContext";
import { WalletsProvider } from "../../context/WalletsContext";
import { RealEstateProvider } from "../../context/RealEstateContext";

/**
 * DashboardLayout component
 * This layout wraps all routes under /dashboard.
 * The UserProvider is inherited from the parent (reserved) layout.
 * * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components to render
 */
interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <PortfolioProvider>
      <ClientsProvider>
        <WalletsProvider>
          <RealEstateProvider>
            <NotificationsProvider>
              <div className="dashboard-container">
                {children}
              </div>
            </NotificationsProvider>
          </RealEstateProvider>
        </WalletsProvider>
      </ClientsProvider>
    </PortfolioProvider>
  );
}