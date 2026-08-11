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

const API_BASE = 'http://localhost:8000';

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [vendors, setVendors] = useState([]);
  const [feed, setFeed] = useState([]);
  const [contagion, setContagion] = useState(null);
  const [selectedVendorId, setSelectedVendorId] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllData();
  }, []);

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

  return (
    <div className="min-h-screen bg-[#0b0f17] text-slate-100 flex font-sans antialiased">
      {/* Navigation Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenAddModal={() => setIsAddModalOpen(true)}
        criticalCount={criticalVendors.length}
        activeIncidentsCount={activeIncidentsCount}
      />

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <Header
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          criticalVendors={criticalVendors}
          onSelectVendor={(id) => setSelectedVendorId(id)}
        />

        {/* View Content */}
        <main className="p-6 flex-1 overflow-y-auto max-w-7xl mx-auto w-full">
          {loading ? (
            <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
              Connecting to Security Risk Engine...
            </div>
          ) : (
            <>
              {activeTab === 'overview' && (
                <OverviewDashboard
                  vendors={vendors}
                  feed={feed}
                  onSelectVendor={(id) => setSelectedVendorId(id)}
                  onOpenAddModal={() => setIsAddModalOpen(true)}
                  onRefreshVendor={fetchAllData}
                  onDeleteVendor={handleDeleteVendor}
                  onNavigateToContagion={() => setActiveTab('contagion')}
                />
              )}

              {activeTab === 'incidents' && (
                <IncidentManager
                  vendors={vendors}
                  onSelectVendor={(id) => setSelectedVendorId(id)}
                  onRefreshVendorData={fetchAllData}
                />
              )}

              {activeTab === 'contagion' && (
                <RiskContagionGraph
                  contagionData={contagion}
                  onSelectVendor={(id) => setSelectedVendorId(id)}
                />
              )}

              {activeTab === 'vendors' && (
                <VendorRoster
                  vendors={vendors}
                  onSelectVendor={(id) => setSelectedVendorId(id)}
                  onOpenAddModal={() => setIsAddModalOpen(true)}
                  onRefreshVendor={fetchAllData}
                  onDeleteVendor={handleDeleteVendor}
                />
              )}

              {activeTab === 'feed' && (
                <LiveActivityFeed
                  feed={feed}
                  onSelectVendor={(id) => setSelectedVendorId(id)}
                />
              )}

              {activeTab === 'quota' && (
                <DevQuotaDrawer
                  isOpen={true}
                  onClose={() => setActiveTab('overview')}
                />
              )}
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
        />
      )}

      {/* Add Vendor Onboarding Modal */}
      <AddVendorModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onVendorAdded={fetchAllData}
      />
    </div>
  );
}
