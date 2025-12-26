import { useState, useEffect } from "react";
import { Plus, Building2, Search, Edit, Trash2 } from "lucide-react";
import EditClientModal from "./EditClientModal";
import DeleteConfirmModal from "./DeleteConfirmModal";
import type { Client } from "@/shared/types";
import { fetchWithAuth } from "@/react-app/utils/api";

export default function ClientsManagement() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deletingClient, setDeletingClient] = useState<Client | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState({ name: "", short_name: "" });
  const [createdCode, setCreatedCode] = useState<string | null>(null);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const response = await fetchWithAuth("/api/admin/clients");
      if (response.ok) {
        const data = await response.json();
        setClients(data);
      }
    } catch (error) {
      console.error("Failed to fetch clients:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await fetchWithAuth("/api/admin/clients", {
        method: "POST",
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const data = await response.json();
        setCreatedCode(data.client_code);
        setTimeout(() => {
          fetchClients();
          setIsCreateModalOpen(false);
          setFormData({ name: "", short_name: "" });
          setCreatedCode(null);
        }, 2000);
      }
    } catch (error) {
      console.error("Failed to create client:", error);
    }
  };

  const handleClientUpdated = () => {
    fetchClients();
    setEditingClient(null);
  };

  const handleDeleteClient = async () => {
    if (!deletingClient) return;

    const response = await fetchWithAuth(`/api/admin/clients/${deletingClient.id}`, {
      method: "DELETE",
    });

    if (response.ok) {
      fetchClients();
      setDeletingClient(null);
    } else {
      throw new Error("Failed to delete client");
    }
  };

  const filteredClients = clients.filter((client) =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.client_code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Clients Management</h2>
          <p className="text-gray-600 mt-1">Manage client organizations</p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add Client
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="mb-4 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search clients..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.map((client) => (
            <div
              key={client.id}
              className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Building2 className="w-5 h-5 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{client.name}</h3>
                  <p className="text-xs text-gray-600 font-mono mt-1">{client.client_code}</p>
                  <p className="text-xs text-gray-500 mt-1">Short: {client.short_name}</p>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setEditingClient(client)}
                    className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    title="Edit client"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeletingClient(client)}
                    className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Delete client"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredClients.length === 0 && (
          <div className="text-center py-12">
            <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No clients found</p>
          </div>
        )}
      </div>

      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            {createdCode ? (
              <div className="text-center space-y-4">
                <div className="text-green-500 text-5xl">✓</div>
                <h3 className="text-2xl font-bold text-gray-900">Client Created!</h3>
                <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-1">Client Code</p>
                  <p className="text-3xl font-bold text-green-600 font-mono">{createdCode}</p>
                </div>
              </div>
            ) : (
              <>
                <h3 className="text-2xl font-bold text-gray-900 mb-6">Add New Client</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Client Name
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Short Name (max 10 characters)
                    </label>
                    <input
                      type="text"
                      value={formData.short_name}
                      onChange={(e) =>
                        setFormData({ ...formData, short_name: e.target.value.slice(0, 10) })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      maxLength={10}
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Used in client code: CL-{formData.short_name.toUpperCase() || "XXX"}-001
                    </p>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreateModalOpen(false);
                        setFormData({ name: "", short_name: "" });
                      }}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      Create Client
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {editingClient && (
        <EditClientModal
          client={editingClient}
          onClose={() => setEditingClient(null)}
          onClientUpdated={handleClientUpdated}
        />
      )}

      {deletingClient && (
        <DeleteConfirmModal
          title="Delete Client"
          message={`Are you sure you want to delete ${deletingClient.name}? This action cannot be undone.`}
          onClose={() => setDeletingClient(null)}
          onConfirm={handleDeleteClient}
        />
      )}
    </div>
  );
}
