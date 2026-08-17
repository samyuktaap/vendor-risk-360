import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Upload, 
  Search, 
  Calendar, 
  CheckCircle2, 
  Clock,
  AlertTriangle,
  Download,
  Trash2,
  Eye,
  File,
  FileCheck,
  XCircle,
  Filter
} from 'lucide-react';

const API_BASE = 'http://localhost:8000';

const DOCUMENT_TYPES = ['SOC 2 Report', 'ISO 27001 Certificate', 'NIST Assessment', 'PCI DSS Report', 'HIPAA Documentation', 'Security Questionnaire', 'Penetration Test Report', 'Other'];
const DOCUMENT_STATUS = ['UPLOADED', 'PROCESSING', 'ANALYZED', 'APPROVED', 'REJECTED'];

export default function DocumentManager({ vendors }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  const [uploadForm, setUploadForm] = useState({
    vendor_id: vendors[0]?.id || '',
    document_type: 'SOC 2 Report',
    title: '',
    file: null,
    description: ''
  });
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // API not yet implemented, return empty state.
  const mockDocuments = [];

  useEffect(() => {
    setDocuments(mockDocuments);
    setLoading(false);
  }, []);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setUploadForm({ ...uploadForm, file, title: file.name });
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadForm.vendor_id || !uploadForm.file) return;

    setUploading(true);
    setUploadProgress(0);

    // Simulate upload progress
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 10;
      });
    }, 200);

    setTimeout(() => {
      clearInterval(interval);
      const newDocument = {
        id: documents.length + 1,
        vendor_id: uploadForm.vendor_id,
        vendor_name: vendors.find(v => v.id === uploadForm.vendor_id)?.name || 'Unknown',
        document_type: uploadForm.document_type,
        title: uploadForm.title || uploadForm.file.name,
        file_name: uploadForm.file.name,
        file_size: `${(uploadForm.file.size / 1024 / 1024).toFixed(2)} MB`,
        uploaded_at: new Date().toISOString(),
        status: 'PROCESSING',
        description: uploadForm.description,
        compliance_score: null,
        gaps_identified: null,
        controls_passed: null,
        controls_total: null
      };

      setDocuments([newDocument, ...documents]);
      setIsUploadModalOpen(false);
      setUploadForm({
        vendor_id: vendors[0]?.id || '',
        document_type: 'SOC 2 Report',
        title: '',
        file: null,
        description: ''
      });
      setUploadProgress(0);
      setUploading(false);
    }, 2000);
  };

  const handleDeleteDocument = (docId) => {
    if (window.confirm('Are you sure you want to delete this document?')) {
      setDocuments(documents.filter(d => d.id !== docId));
    }
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesType = selectedType === 'ALL' || doc.document_type === selectedType;
    const matchesStatus = selectedStatus === 'ALL' || doc.status === selectedStatus;
    const matchesSearch = 
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.vendor_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.file_name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesStatus && matchesSearch;
  });

  const statusCounts = {
    UPLOADED: documents.filter(d => d.status === 'UPLOADED').length,
    PROCESSING: documents.filter(d => d.status === 'PROCESSING').length,
    ANALYZED: documents.filter(d => d.status === 'ANALYZED').length,
    APPROVED: documents.filter(d => d.status === 'APPROVED').length,
    REJECTED: documents.filter(d => d.status === 'REJECTED').length
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'APPROVED': return <CheckCircle2 className="w-4 h-4 text-[#00C853]" />;
      case 'ANALYZED': return <FileCheck className="w-4 h-4 text-[#00D4AA]" />;
      case 'PROCESSING': return <Clock className="w-4 h-4 text-[#FFB800] animate-spin" />;
      case 'REJECTED': return <XCircle className="w-4 h-4 text-[#E63946]" />;
      default: return <File className="w-4 h-4 text-slate-400" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'APPROVED': return 'bg-[#00C853]/20 text-[#00C853] border-[#00C853]/30';
      case 'ANALYZED': return 'bg-[#00D4AA]/20 text-[#00D4AA] border-[#00D4AA]/30';
      case 'PROCESSING': return 'bg-[#FFB800]/20 text-[#FFB800] border-[#FFB800]/30';
      case 'REJECTED': return 'bg-[#E63946]/20 text-[#E63946] border-[#E63946]/30';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl glass-panel-liquid border border-white/[0.08] shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#0066FF]/20 text-[#0066FF] border border-[#0066FF]/30 flex items-center gap-1">
              <FileText className="w-3 h-3 text-[#0066FF]" /> DOCUMENT ENGINE
            </span>
            <span className="text-xs text-slate-400">VendorAuditAI-Inspired Management</span>
          </div>
          <h2 className="text-2xl font-bold text-[#F8FAFC] tracking-tight mt-1">Document Management Center</h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Upload and process SOC 2 reports, ISO certifications, and security questionnaires with AI-powered semantic chunking and automatic classification.
          </p>
        </div>

        <button
          onClick={() => setIsUploadModalOpen(true)}
          className="bg-gradient-to-r from-[#0066FF] to-[#00D4AA] hover:from-[#0056E6] hover:to-[#00C4A0] text-white font-semibold text-xs py-3 px-5 rounded-xl shadow-lg shadow-[#0066FF]/20 flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] self-start md:self-auto"
        >
          <Upload className="w-4 h-4 stroke-[2.5]" />
          <span>Upload Document</span>
        </button>
      </div>

      {/* Overview Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="p-4 rounded-xl glass-card border border-white/[0.08] shadow-md card-hover-lift">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Total Documents</span>
            <FileText className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#F8FAFC]">{documents.length}</span>
            <span className="text-[11px] text-slate-400">uploaded</span>
          </div>
        </div>

        <div className="p-4 rounded-xl glass-card border border-white/[0.08] shadow-md card-hover-lift">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Processing</span>
            <Clock className="w-4 h-4 text-[#FFB800]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#FFB800]">{statusCounts.PROCESSING}</span>
            <span className="text-[11px] text-[#FFB800]/80 font-medium">in queue</span>
          </div>
        </div>

        <div className="p-4 rounded-xl glass-card border border-white/[0.08] shadow-md card-hover-lift">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Analyzed</span>
            <FileCheck className="w-4 h-4 text-[#00D4AA]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#00D4AA]">{statusCounts.ANALYZED}</span>
            <span className="text-[11px] text-[#00D4AA]/80 font-medium">processed</span>
          </div>
        </div>

        <div className="p-4 rounded-xl glass-card border border-white/[0.08] shadow-md card-hover-lift">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Approved</span>
            <CheckCircle2 className="w-4 h-4 text-[#00C853]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#00C853]">{statusCounts.APPROVED}</span>
            <span className="text-[11px] text-[#00C853]/80 font-medium">verified</span>
          </div>
        </div>

        <div className="p-4 rounded-xl glass-card border border-white/[0.08] shadow-md card-hover-lift">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Rejected</span>
            <XCircle className="w-4 h-4 text-[#E63946]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#E63946]">{statusCounts.REJECTED}</span>
            <span className="text-[11px] text-[#E63946]/80 font-medium">issues</span>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 transform -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents by title, vendor, or filename..."
            className="w-full bg-black/20 border border-white/[0.08] focus:border-[#0066FF] rounded-xl pl-9 pr-4 py-2 text-xs text-[#F8FAFC] placeholder-slate-500 focus:outline-none focus:shadow-[0_0_20px_rgba(0,102,255,0.1)]"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="bg-black/20 border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-slate-300 focus:border-[#0066FF] focus:outline-none"
          >
            <option value="ALL">All Types</option>
            {DOCUMENT_TYPES.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-black/20 border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-slate-300 focus:border-[#0066FF] focus:outline-none"
          >
            <option value="ALL">All Status</option>
            {DOCUMENT_STATUS.map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Documents Table */}
      <div className="rounded-xl glass-panel border border-white/[0.08] overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/[0.08] bg-black/20 text-slate-400 font-semibold">
                <th className="py-3 px-4">Document</th>
                <th className="py-3 px-4">Vendor</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Compliance Score</th>
                <th className="py-3 px-4">Uploaded</th>
                <th className="py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {filteredDocuments.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400 text-xs">
                    <FileText className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    No documents found. Upload your first compliance document.
                  </td>
                </tr>
              ) : filteredDocuments.map((doc) => (
                <tr key={doc.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-black/20 border border-white/[0.08] flex items-center justify-center">
                        <FileText className="w-5 h-5 text-[#0066FF]" />
                      </div>
                      <div>
                        <div className="font-medium text-[#F8FAFC]">{doc.title}</div>
                        <div className="text-[10px] text-slate-500">{doc.file_name} • {doc.file_size}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-slate-300">{doc.vendor_name}</td>
                  <td className="py-3.5 px-4">
                    <span className="px-2 py-0.5 rounded-full bg-black/20 text-slate-300 text-[10px] border border-white/[0.08]">
                      {doc.document_type}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 w-fit border ${getStatusColor(doc.status)}`}>
                      {getStatusIcon(doc.status)}
                      {doc.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    {doc.compliance_score !== null ? (
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-2 bg-black/30 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${doc.compliance_score >= 80 ? 'bg-[#00C853]' : doc.compliance_score >= 60 ? 'bg-[#FFB800]' : 'bg-[#E63946]'}`}
                            style={{ width: `${doc.compliance_score}%` }}
                          />
                        </div>
                        <span className="font-mono text-slate-300">{doc.compliance_score}%</span>
                      </div>
                    ) : (
                      <span className="text-slate-500 text-[10px]">Pending</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-slate-400 text-[10px]">
                    {new Date(doc.uploaded_at).toLocaleDateString()}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-1">
                      <button className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-cyan-400 transition-colors" title="View Document">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-emerald-400 transition-colors" title="Download">
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteDocument(doc.id)}
                        className="p-1.5 rounded-lg bg-black/20 hover:bg-black/30 text-slate-400 hover:text-[#E63946] transition-colors border border-white/[0.08]"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upload Document Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel border border-white/[0.08] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-[#0066FF]" />
                <h3 className="text-base font-bold text-[#F8FAFC]">Upload Compliance Document</h3>
              </div>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="text-slate-400 hover:text-[#F8FAFC] text-xs font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpload} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Target Vendor *</label>
                <select
                  value={uploadForm.vendor_id}
                  onChange={(e) => setUploadForm({ ...uploadForm, vendor_id: Number(e.target.value) })}
                  className="w-full bg-black/20 border border-white/[0.08] rounded-lg p-2.5 text-[#F8FAFC] focus:border-[#0066FF] focus:outline-none"
                  required
                >
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.domain})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Document Type *</label>
                <select
                  value={uploadForm.document_type}
                  onChange={(e) => setUploadForm({ ...uploadForm, document_type: e.target.value })}
                  className="w-full bg-black/20 border border-white/[0.08] rounded-lg p-2.5 text-[#F8FAFC] focus:border-[#0066FF] focus:outline-none"
                  required
                >
                  {DOCUMENT_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Document File *</label>
                <div className="border-2 border-dashed border-white/[0.12] rounded-lg p-6 text-center hover:border-[#0066FF] transition-colors cursor-pointer bg-black/10">
                  <input
                    type="file"
                    onChange={handleFileUpload}
                    accept=".pdf,.doc,.docx,.xlsx"
                    className="hidden"
                    id="file-upload"
                    required
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    {uploadForm.file ? (
                      <div className="flex items-center justify-center gap-2 text-[#00C853]">
                        <FilePdf className="w-8 h-8" />
                        <span className="font-medium">{uploadForm.file.name}</span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Upload className="w-8 h-8 text-slate-500 mx-auto" />
                        <p className="text-slate-400">Click to upload or drag and drop</p>
                        <p className="text-slate-500 text-[10px]">PDF, DOC, DOCX, XLSX (Max 10MB)</p>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Title</label>
                <input
                  type="text"
                  placeholder="Document title (optional)"
                  value={uploadForm.title}
                  onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                  className="w-full bg-black/20 border border-white/[0.08] rounded-lg p-2.5 text-[#F8FAFC] placeholder-slate-500 focus:border-[#0066FF] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Description</label>
                <textarea
                  rows="3"
                  placeholder="Document description (optional)"
                  value={uploadForm.description}
                  onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                  className="w-full bg-black/20 border border-white/[0.08] rounded-lg p-2.5 text-[#F8FAFC] placeholder-slate-500 focus:border-[#0066FF] focus:outline-none resize-none"
                />
              </div>

              {uploading && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Uploading...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-black/30 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-[#0066FF] transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  disabled={uploading}
                  className="px-4 py-2 bg-black/20 hover:bg-black/30 text-slate-300 rounded-xl text-xs font-semibold disabled:opacity-50 border border-white/[0.08]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading || !uploadForm.file}
                  className="px-5 py-2 bg-gradient-to-r from-[#0066FF] to-[#00D4AA] hover:from-[#0056E6] hover:to-[#00C4A0] text-white font-semibold rounded-xl text-xs shadow-lg shadow-[#0066FF]/20 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {uploading ? 'Uploading...' : 'Upload Document'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
