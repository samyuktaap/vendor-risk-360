import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import OverviewDashboard from './components/OverviewDashboard';
import RiskContagionGraph from './components/RiskContagionGraph';
import VendorRoster from './components/VendorRoster';
import LiveActivityFeed from './components/LiveActivityFeed';
import DevQuotaDrawer from './components/DevQuotaDrawer';
import VendorDetailModal from './components/VendorDetailModal';
import AddVendorModal from './components/AddVendorModal';
import IncidentManager from './components/IncidentManager';
import ComplianceManager from './components/ComplianceManager';
import RemediationManager from './components/RemediationManager';
import DocumentManager from './components/DocumentManager';
import OperationalRiskManager from './components/OperationalRiskManager';
import AlertManager from './components/AlertManager';
import AuthModal from './components/AuthModal';
import VendorSelfServicePortal from './components/VendorSelfServicePortal';
import VoiceGuidedDemoModal from './components/VoiceGuidedDemoModal';

const API_BASE = 'http://localhost:8000';

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [vendors, setVendors] = useState([]);
  const [feed, setFeed] = useState([]);
  const [contagion, setContagion] = useState(null);
  const [selectedVendorId, setSelectedVendorId] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isVoiceDemoOpen, setIsVoiceDemoOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [unreadAlertCount, setUnreadAlertCount] = useState(0);

  // Active User Authentication State
  const [currentUser, setCurrentUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);

  // Helper to determine if the logged‑in user is a Vendor
  const isVendor = (user) => {
    if (!user) return false;
    return (
      user.account_type === 'VENDOR' ||
      (typeof user.role === 'string' && user.role.toUpperCase() === 'VENDOR')
    );
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const fetchVendorsOnly = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/vendors`);
      if (res.ok) setVendors(await res.json());
    } catch (e) { /* silent */ }
  };

  const checkAuth = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const user = data.user;
        setCurrentUser(user);
        if (!isVendor(user)) {
          await fetchAllData();
        } else {
          setLoading(false);
        }
      } else {
        setCurrentUser(null);
        await fetchVendorsOnly();
        setIsAuthModalOpen(true);
      }
    } catch (err) {
      console.error("Error checking auth status:", err);
      setCurrentUser(null);
      await fetchVendorsOnly();
      setIsAuthModalOpen(true);
    } finally {
      setAuthChecking(false);
    }
  };

  const handleLogin = (user) => {
    setCurrentUser(user);
    if (!isVendor(user)) {
      fetchAllData();
      fetchAlertCount();
    }
  };

  const fetchAlertCount = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/alerts/count`);
      if (res.ok) {
        const data = await res.json();
        setUnreadAlertCount(data.unread || 0);
      }
    } catch (e) {
      // silent - header badge is non-critical
    }
  };

  const handleSignOut = async () => {
    try {
      await fetch(`${API_BASE}/api/auth/logout`, { method: 'POST', credentials: 'include' });
    } catch (e) {}
    setCurrentUser(null);
    setVendors([]);
    setFeed([]);
    setContagion(null);
    setSelectedVendorId(null);
    setIsAuthModalOpen(true);
  };

  const fetchAllData = async () => {
    try {
      const [vRes, fRes, cRes] = await Promise.all([
        fetch(`${API_BASE}/api/vendors`),
        fetch(`${API_BASE}/api/feed`),
        fetch(`${API_BASE}/api/contagion`)
      ]);

      if (vRes.ok) setVendors(await vRes.json());
      if (fRes.ok) setFeed(await fRes.json());
      if (cRes.ok) setContagion(await cRes.json());
    } catch (err) {
      console.error("Error fetching Dashboard Data:", err);
    } finally {
      setLoading(false);
    }
    // Refresh alert count silently
    fetchAlertCount();
  };

  const criticalVendors = vendors.filter(v => v.risk_score >= 70);
  const activeIncidentsCount = vendors.reduce((sum, v) => sum + (v.active_incidents || 0), 0);

  const handleDeleteVendor = async (vendorId) => {
    if (!window.confirm("Are you sure you want to remove this vendor from security monitoring?")) return;

    try {
      const res = await fetch(`${API_BASE}/api/vendors/${vendorId}`, { method: 'DELETE' });
      if (res.ok) {
        if (selectedVendorId === vendorId) setSelectedVendorId(null);
        await fetchAllData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#0b0f17] flex items-center justify-center text-slate-400 text-sm">
        Connecting to Security Risk Engine...
      </div>
    );
  }

  // Dedicated View for Vendor Portal Login
  if (currentUser && isVendor(currentUser)) {
    return (
      <>
        <VendorSelfServicePortal
          user={currentUser}
          onSignOut={handleSignOut}
        />
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          onLogin={handleLogin}
          vendors={vendors}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0f17] text-slate-100 flex font-sans antialiased">
      {/* Navigation Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          // Refresh alert count when navigating to alerts tab
          if (tab === 'alerts') fetchAlertCount();
        }}
        onOpenAddModal={() => setIsAddModalOpen(true)}
        criticalCount={criticalVendors.length}
        activeIncidentsCount={activeIncidentsCount}
        unreadAlertCount={unreadAlertCount}
      />

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <Header
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          criticalVendors={criticalVendors}
          onSelectVendor={(id) => setSelectedVendorId(id)}
          currentUser={currentUser}
          onOpenAuth={() => setIsAuthModalOpen(true)}
          onSignOut={handleSignOut}
          onOpenVoiceDemo={() => setIsVoiceDemoOpen(true)}
          unreadAlertCount={unreadAlertCount}
          onOpenAlerts={() => setActiveTab('alerts')}
        />

        {/* View Content */}
        <main className="p-6 flex-1 overflow-y-auto max-w-7xl mx-auto w-full">
          {loading ? (
            <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
              Connecting to Security Risk Engine...
            </div>
          ) : (
            <>
              {/* Dedicated CISO Command Center Dashboard */}
              <OverviewDashboard
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                vendors={vendors}
                feed={feed}
                onSelectVendor={(id) => setSelectedVendorId(id)}
                onOpenAddModal={() => setIsAddModalOpen(true)}
                onRefreshVendor={fetchAllData}
                onDeleteVendor={handleDeleteVendor}
                onNavigateToContagion={() => setActiveTab('risk-management')}
              />
            </>
          )}
        </main>
      </div>

      {/* Vendor Detail Side Drawer / Modal */}
      {selectedVendorId && (
        <VendorDetailModal
          vendorId={selectedVendorId}
          onClose={() => setSelectedVendorId(null)}
          onRefreshVendor={fetchAllData}
          currentUser={currentUser}
        />
      )}

      {/* Add Vendor Onboarding Modal */}
      <AddVendorModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onVendorAdded={fetchAllData}
      />

      {/* Auth Sign In Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onLogin={handleLogin}
        vendors={vendors}
      />

      {/* Voice-Guided Demo Modal */}
      <VoiceGuidedDemoModal
        isOpen={isVoiceDemoOpen}
        onClose={() => setIsVoiceDemoOpen(false)}
      />
    </div>
  );
}
