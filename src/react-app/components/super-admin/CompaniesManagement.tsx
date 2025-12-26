import { useState, useEffect } from 'react';
import { Building2, Plus, Edit, Trash2, X, Users } from 'lucide-react';
import { fetchWithAuth } from '@/react-app/utils/api';

interface Company {
  id: number;
  name: string;
  company_code: string;
  logo_url: string;
  is_active: number;
  admin_count: number;
  total_users: number;
  created_at: string;
}

interface CompanyFormData {
  name: string;
  company_code: string;
  logo_url: string;
}

interface AdminFormData {
  name: string;
  email: string;
  password: string;
}

export default function CompaniesManagement() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [formData, setFormData] = useState<CompanyFormData>({
    name: '',
    company_code: '',
    logo_url: ''
  });
  const [showCreateAdminModal, setShowCreateAdminModal] = useState(false);
  const [selectedCompanyForAdmin, setSelectedCompanyForAdmin] = useState<Company | null>(null);
  const [adminFormData, setAdminFormData] = useState<AdminFormData>({
    name: '',
    email: '',
    password: ''
  });

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const response = await fetchWithAuth('/api/super-admin/companies');
      if (response.ok) {
        const data = await response.json();
        setCompanies(data);
      }
    } catch (error) {
      console.error('Failed to fetch companies:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.name || !formData.company_code) {
      alert('Name and company code are required');
      return;
    }

    try {
      const response = await fetchWithAuth('/api/super-admin/companies', {
        method: 'POST',
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        setShowCreateModal(false);
        setFormData({ name: '', company_code: '', logo_url: '' });
        fetchCompanies();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create company');
      }
    } catch (error) {
      console.error('Failed to create company:', error);
      alert('Failed to create company');
    }
  };

  const handleEdit = async () => {
    if (!selectedCompany) return;

    try {
      const response = await fetchWithAuth(`/api/super-admin/companies/${selectedCompany.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...formData,
          is_active: selectedCompany.is_active
        })
      });

      if (response.ok) {
        setShowEditModal(false);
        setSelectedCompany(null);
        setFormData({ name: '', company_code: '', logo_url: '' });
        fetchCompanies();
      }
    } catch (error) {
      console.error('Failed to update company:', error);
    }
  };

  const handleDelete = async (company: Company) => {
    if (!confirm(`Are you sure you want to delete ${company.name}?`)) return;

    try {
      const response = await fetchWithAuth(`/api/super-admin/companies/${company.id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        fetchCompanies();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to delete company');
      }
    } catch (error) {
      console.error('Failed to delete company:', error);
    }
  };

  const openEditModal = (company: Company) => {
    setSelectedCompany(company);
    setFormData({
      name: company.name,
      company_code: company.company_code,
      logo_url: company.logo_url || ''
    });
    setShowEditModal(true);
  };

  const openCreateAdminModal = (company: Company) => {
    setSelectedCompanyForAdmin(company);
    setShowCreateAdminModal(true);
  };

  const handleCreateAdmin = async () => {
    if (!selectedCompanyForAdmin || !adminFormData.name || !adminFormData.email || !adminFormData.password) {
      alert('All fields are required');
      return;
    }

    try {
      const response = await fetchWithAuth(`/api/super-admin/companies/${selectedCompanyForAdmin.id}/admin`, {
        method: 'POST',
        body: JSON.stringify(adminFormData)
      });

      if (response.ok) {
        setShowCreateAdminModal(false);
        setSelectedCompanyForAdmin(null);
        setAdminFormData({ name: '', email: '', password: '' });
        fetchCompanies();
        alert('Admin created successfully');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create admin');
      }
    } catch (error) {
      console.error('Failed to create admin:', error);
      alert('Failed to create admin');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Companies</h2>
          <p className="text-slate-500 mt-1">Manage all companies on the platform</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Create Company
        </button>
      </div>

      {/* Companies Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {companies.map((company) => (
          <div
            key={company.id}
            className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden hover:shadow-xl transition-shadow"
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center">
                    {company.logo_url ? (
                      <img src={company.logo_url} alt={company.name} className="w-full h-full object-cover rounded-xl" />
                    ) : (
                      <Building2 className="w-6 h-6 text-white" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">{company.name}</h3>
                    <p className="text-xs text-slate-500 font-mono">{company.company_code}</p>
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                  company.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                }`}>
                  {company.is_active ? 'Active' : 'Inactive'}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-xs text-blue-600 mb-1">Admins</p>
                  <p className="text-xl font-bold text-blue-700">{company.admin_count}</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-3">
                  <p className="text-xs text-purple-600 mb-1">Total Users</p>
                  <p className="text-xl font-bold text-purple-700">{company.total_users}</p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => openCreateAdminModal(company)}
                  className="flex-1 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors flex items-center justify-center gap-2"
                >
                  <Users className="w-4 h-4" />
                  Add Admin
                </button>
              </div>
              
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => openEditModal(company)}
                  className="flex-1 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2"
                >
                  <Edit className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(company)}
                  className="flex-1 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {companies.length === 0 && (
        <div className="text-center py-12 bg-white rounded-2xl shadow-lg border border-slate-200">
          <Building2 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 mb-4">No companies yet</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="text-indigo-600 hover:text-indigo-800 font-medium"
          >
            Create your first company
          </button>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-800">Create Company</h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setFormData({ name: '', company_code: '', logo_url: '' });
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Company Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter company name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Company Code *</label>
                <input
                  type="text"
                  value={formData.company_code}
                  onChange={(e) => setFormData({ ...formData, company_code: e.target.value.toUpperCase() })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  placeholder="COMP001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Logo URL</label>
                <input
                  type="text"
                  value={formData.logo_url}
                  onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="https://example.com/logo.png"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setFormData({ name: '', company_code: '', logo_url: '' });
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium hover:from-indigo-700 hover:to-purple-700 transition-all"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Admin Modal */}
      {showCreateAdminModal && selectedCompanyForAdmin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-800">Create Admin</h3>
                <p className="text-sm text-slate-500">For {selectedCompanyForAdmin.name}</p>
              </div>
              <button
                onClick={() => {
                  setShowCreateAdminModal(false);
                  setSelectedCompanyForAdmin(null);
                  setAdminFormData({ name: '', email: '', password: '' });
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Full Name *</label>
                <input
                  type="text"
                  value={adminFormData.name}
                  onChange={(e) => setAdminFormData({ ...adminFormData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter admin name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Email *</label>
                <input
                  type="email"
                  value={adminFormData.email}
                  onChange={(e) => setAdminFormData({ ...adminFormData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="admin@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Password *</label>
                <input
                  type="password"
                  value={adminFormData.password}
                  onChange={(e) => setAdminFormData({ ...adminFormData, password: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter password"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowCreateAdminModal(false);
                    setSelectedCompanyForAdmin(null);
                    setAdminFormData({ name: '', email: '', password: '' });
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateAdmin}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg font-medium hover:from-emerald-700 hover:to-teal-700 transition-all"
                >
                  Create Admin
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedCompany && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-800">Edit Company</h3>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedCompany(null);
                  setFormData({ name: '', company_code: '', logo_url: '' });
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Company Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Company Code *</label>
                <input
                  type="text"
                  value={formData.company_code}
                  onChange={(e) => setFormData({ ...formData, company_code: e.target.value.toUpperCase() })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Logo URL</label>
                <input
                  type="text"
                  value={formData.logo_url}
                  onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedCompany(null);
                    setFormData({ name: '', company_code: '', logo_url: '' });
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEdit}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium hover:from-indigo-700 hover:to-purple-700 transition-all"
                >
                  Update
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
