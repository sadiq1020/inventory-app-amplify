// src/pages/StockPage.jsx
import React, { useState, useEffect } from "react";
import { fetchAuthSession, signOut } from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";
import Sidebar from "../components/Sidebar";
import AddStockModal from "../components/AddStockModal";
import PageHeader from "../components/PageHeader";
import DeleteConfirmModal from "../utils/DeleteConfirmModal";
import { fetchStock, deleteStockItem } from "../utils/stockService";
import {
  LogOut, Plus, Search, Filter, ArrowUpDown,
  Download, MoreVertical, Edit, Trash, Package, AlertCircle,
  RefreshCw
} from "lucide-react";

function StockPage() {
  const [activeTab, setActiveTab] = useState("retail");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "itemType", direction: "ascending" });
  const [showLowStock, setShowLowStock] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [retailStock, setRetailStock] = useState([]);
  const [wholesaleStock, setWholesaleStock] = useState([]);
  const [error, setError] = useState(null);
  const [itemToEdit, setItemToEdit] = useState(null);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  // Check authentication status
  const checkAuthStatus = async () => {
    try {
      const session = await fetchAuthSession();
      const authenticated = !!(session.tokens?.idToken || session.tokens?.accessToken);
      setIsAuthenticated(authenticated);

      if (!authenticated) {
        // Redirect to login page or show login component
        window.location.href = "/"; // Adjust this to your login route
        return false;
      }
      return true;
    } catch (error) {
      console.error("Auth check failed:", error);
      setIsAuthenticated(false);
      window.location.href = "/"; // Redirect to login
      return false;
    } finally {
      setAuthLoading(false);
    }
  };

  // Listen for auth events
  // Listen for auth events - FIXED VERSION
  useEffect(() => {
    const hubListener = (data) => {
      const { event } = data.payload;
      if (event === 'signedOut') {
        setIsAuthenticated(false);
        window.location.href = "/";
      }
    };

    // Hub.listen returns an unsubscribe function
    const unsubscribe = Hub.listen('auth', hubListener);

    // Return the unsubscribe function to clean up
    return unsubscribe;
  }, []);

  // Initial auth check and data fetch
  useEffect(() => {
    const initializeApp = async () => {
      const authenticated = await checkAuthStatus();
      if (authenticated) {
        await fetchData();
      }
    };

    initializeApp();
  }, []);

  // Fetch data when active tab changes
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      fetchData();
    }
  }, [activeTab, isAuthenticated, authLoading]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString() || session.tokens?.accessToken?.toString();

      if (!idToken) {
        throw new Error("No valid authentication token found");
      }

      // Fetch retail stock data
      const retailData = await fetchStock("Retail_Stock", idToken);
      setRetailStock(retailData);

      // Fetch wholesale stock data
      const wholesaleData = await fetchStock("Wholesale_Stock", idToken);
      setWholesaleStock(wholesaleData);

      setError(null);
    } catch (err) {
      console.error("Error fetching stock data:", err);
      setError("Failed to load stock data. Please try again later.");

      // If auth error, redirect to login
      if (err.message.includes("authentication") || err.message.includes("token")) {
        setIsAuthenticated(false);
        window.location.href = "/";
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setIsAuthenticated(false);
      window.location.href = "/";
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  // Show loading while checking authentication
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700"></div>
        <span className="ml-3 text-gray-700">Checking authentication...</span>
      </div>
    );
  }

  // Don't render if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  // Get current stock based on active tab
  const currentStock = activeTab === "retail" ? retailStock : wholesaleStock;
  const currentTableName = activeTab === "retail" ? "Retail_Stock" : "Wholesale_Stock";

  // Calculate total value for each item based on the stock type
  const calculateTotalValue = (item) => {
    if (activeTab === "retail") {
      // For retail: Total Value = Unit Price × Quantity (pcs)
      return item.unitPrice * item.quantity;
    } else {
      // For wholesale: Total Value = Unit Price × Quantity (packets) × 20
      return item.unitPrice * item.quantity * 20;
    }
  };

  const handleSearch = (e) => setSearchQuery(e.target.value);

  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const filteredAndSortedStock = currentStock
    .filter(item => {
      const matchesSearch = item.itemType.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.variationName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesLowStock = !showLowStock || item.quantity <= item.lowStockThreshold;
      return matchesSearch && matchesLowStock;
    })
    .sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'ascending' ? -1 : 1;
      if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'ascending' ? 1 : -1;
      return 0;
    });

  const toggleActionsMenu = (itemId) => {
    setShowActionsMenu(showActionsMenu === itemId ? null : itemId);
  };

  const handleEditItem = (item) => {
    // Set the item to edit and open the modal
    setItemToEdit({
      itemType: item.itemType,
      variation: item.variationName,
      stockType: activeTab === "retail" ? "Retail" : "Wholesale",
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lowStockThreshold: item.lowStockThreshold,
      isEditing: true
    });
    setIsAddModalOpen(true);
    setShowActionsMenu(null);
  };

  const handleDeleteItem = (item) => {
    // Set the item to delete and open the confirmation modal
    setItemToDelete({
      itemType: item.itemType,
      variationName: item.variationName,
    });
    setIsDeleteModalOpen(true);
    setShowActionsMenu(null);
  };

  const confirmDeleteItem = async () => {
    if (!itemToDelete) return;

    try {
      setIsLoading(true);
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString() || session.tokens?.accessToken?.toString();

      await deleteStockItem(
        currentTableName,
        itemToDelete.itemType,
        itemToDelete.variationName,
        idToken
      );

      // Refresh data after successful deletion
      await fetchData();
      setError(null);
    } catch (err) {
      console.error("Error deleting item:", err);
      setError("Failed to delete item. Please try again later.");
    } finally {
      setIsLoading(false);
      setIsDeleteModalOpen(false);
      setItemToDelete(null);
    }
  };

  const handleExportData = () => {
    // Create CSV data from filteredAndSortedStock
    const headers = [
      "Item Type",
      "Variation",
      activeTab === "retail" ? "Quantity (pcs)" : "Quantity (packets)",
      "Unit Price",
      "Total Value"
    ];

    const csvData = [
      headers.join(","),
      ...filteredAndSortedStock.map(item => {
        const totalValue = calculateTotalValue(item);
        return `"${item.itemType}","${item.variationName}",${item.quantity},${item.unitPrice ? item.unitPrice.toFixed(2) : "0.00"},${totalValue.toFixed(2)}`;
      })
    ].join("\n");

    // Create download link
    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `${activeTab}-stock-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleAddModalClose = () => {
    setIsAddModalOpen(false);
    setItemToEdit(null);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />

      <div className="flex-1 overflow-auto">
        <PageHeader />
        <main className="p-6 max-w-7xl mx-auto">
          {/* Tabs & Actions */}
          <div className="mb-6 bg-white p-4 rounded-lg shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 md:gap-2">

              {/* Retail & Wholesale Filters */}
              <div className="flex space-x-2">
                <button
                  onClick={() => setActiveTab("retail")}
                  className={`flex-1 px-4 py-2 rounded-md ${activeTab === "retail"
                    ? "bg-blue-100 text-blue-700 font-medium"
                    : "text-gray-600 hover:bg-gray-100"
                    }`}
                >
                  Retail Stock
                </button>
                <button
                  onClick={() => setActiveTab("wholesale")}
                  className={`flex-1 px-4 py-2 rounded-md ${activeTab === "wholesale"
                    ? "bg-green-100 text-green-700 font-medium"
                    : "text-gray-600 hover:bg-gray-100"
                    }`}
                >
                  Wholesale Stock
                </button>
              </div>

              {/* Search and Low Stock */}
              <div className="flex flex-col sm:flex-row sm:space-x-2 gap-2">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <Search size={16} className="text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search items..."
                    value={searchQuery}
                    onChange={handleSearch}
                    className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <button
                  onClick={() => setShowLowStock(!showLowStock)}
                  className={`flex items-center justify-center px-3 py-2 rounded-md border flex-shrink-0 ${showLowStock
                    ? "bg-amber-50 border-amber-200 text-amber-700"
                    : "border-gray-300 hover:bg-gray-50"
                    }`}
                >
                  <AlertCircle size={16} className="mr-1" />
                  Low Stock
                </button>
              </div>

              {/* Export and Refresh */}
              <div className="flex flex-col min-[400px]:flex-row gap-2">

                <button
                  onClick={handleExportData}
                  className="flex-1 flex items-center justify-center px-3 py-2 rounded-md border border-gray-300 hover:bg-gray-50"
                >
                  <Download size={16} className="mr-1" />
                  Export
                </button>

                <button
                  onClick={fetchData}
                  className="flex-1 flex items-center justify-center px-3 py-2 rounded-md border border-gray-300 hover:bg-gray-50"
                >
                  <RefreshCw size={16} className="mr-1" />
                  Refresh
                </button>
              </div>

              {/* Add Item Button */}
              <div>
                <button
                  onClick={() => {
                    setItemToEdit(null);
                    setIsAddModalOpen(true);
                  }}
                  className="w-full flex items-center justify-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  <Plus size={16} className="mr-1" />
                  Add Item
                </button>
              </div>

            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-700">
              <p className="flex items-center">
                <AlertCircle size={16} className="mr-2" />
                {error}
              </p>
            </div>
          )}

          {/* Loading state */}
          {isLoading ? (
            <div className="flex justify-center items-center p-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700"></div>
              <span className="ml-3 text-gray-700">Loading stock data...</span>
            </div>
          ) : (
            /* Table */
            <div className="bg-white overflow-hidden shadow-sm rounded-lg">
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className={activeTab === "retail" ? "bg-blue-50" : "bg-green-50"}>
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-700" onClick={() => requestSort("itemType")}>
                        <div className="flex items-center cursor-pointer">
                          Item Type
                          {sortConfig.key === "itemType" && (
                            <ArrowUpDown size={14} className="ml-1" />
                          )}
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-700" onClick={() => requestSort("variationName")}>
                        <div className="flex items-center cursor-pointer">
                          Variation
                          {sortConfig.key === "variationName" && (
                            <ArrowUpDown size={14} className="ml-1" />
                          )}
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-700" onClick={() => requestSort("quantity")}>
                        <div className="flex items-center cursor-pointer">
                          {activeTab === "retail" ? "Quantity (pcs)" : "Quantity (packets)"}
                          {sortConfig.key === "quantity" && (
                            <ArrowUpDown size={14} className="ml-1" />
                          )}
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-700" onClick={() => requestSort("unitPrice")}>
                        <div className="flex items-center cursor-pointer">
                          Unit Price
                          {sortConfig.key === "unitPrice" && (
                            <ArrowUpDown size={14} className="ml-1" />
                          )}
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-700">
                        <div className="flex items-center cursor-pointer" onClick={() => requestSort("totalValue")}>
                          Total Value
                          {sortConfig.key === "totalValue" && (
                            <ArrowUpDown size={14} className="ml-1" />
                          )}
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-700">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredAndSortedStock.length > 0 ? (
                      filteredAndSortedStock.map((item) => {
                        const totalValue = calculateTotalValue(item);
                        return (
                          <tr key={item.id} className={item.quantity <= item.lowStockThreshold ? "bg-amber-50" : ""}>
                            <td className="px-6 py-4">{item.itemType}</td>
                            <td className="px-6 py-4">{item.variationName}</td>
                            <td className="px-6 py-4">
                              <span className={item.quantity <= item.lowStockThreshold ? "text-amber-700 font-medium" : ""}>
                                {item.quantity}
                              </span>
                              {item.quantity <= item.lowStockThreshold && (
                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                                  <AlertCircle size={12} className="mr-1" />
                                  Low
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4">${item.unitPrice ? item.unitPrice.toFixed(2) : "0.00"}</td>
                            <td className="px-6 py-4">${totalValue.toFixed(2)}</td>
                            <td className="px-6 py-4 relative">
                              <button onClick={() => toggleActionsMenu(item.id)} className="text-gray-400 hover:text-gray-600">
                                <MoreVertical size={16} />
                              </button>

                              {showActionsMenu === item.id && (
                                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border border-gray-200">
                                  <div className="py-1">
                                    <button
                                      onClick={() => handleEditItem(item)}
                                      className="flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                    >
                                      <Edit size={14} className="mr-2" />
                                      Edit Item
                                    </button>
                                    <button
                                      onClick={() => handleDeleteItem(item)}
                                      className="flex items-center w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                                    >
                                      <Trash size={14} className="mr-2" />
                                      Delete Item
                                    </button>
                                  </div>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                          <Package size={48} className="mx-auto mb-4 text-gray-400" />
                          <p className="text-lg">No stock items found</p>
                          <p className="text-sm mt-1">
                            {searchQuery ? "Try changing your search query" : "Start by adding some items to your inventory"}
                          </p>
                          <button
                            onClick={() => {
                              setItemToEdit(null);
                              setIsAddModalOpen(true);
                            }}
                            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                          >
                            Add New Item
                          </button>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden">
                {filteredAndSortedStock.length > 0 ? (
                  <div className="divide-y divide-gray-200">
                    {filteredAndSortedStock.map((item) => {
                      const totalValue = calculateTotalValue(item);
                      return (
                        <div key={item.id} className={`p-4 ${item.quantity <= item.lowStockThreshold ? "bg-amber-50" : "bg-white"}`}>
                          {/* Item Header */}
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex-1">
                              <h3 className="font-medium text-gray-900">{item.itemType}</h3>
                              <p className="text-sm text-gray-600">{item.variationName}</p>
                            </div>
                            <div className="relative ml-2">
                              <button
                                onClick={() => toggleActionsMenu(item.id)}
                                className="text-gray-400 hover:text-gray-600 p-1"
                              >
                                <MoreVertical size={16} />
                              </button>

                              {showActionsMenu === item.id && (
                                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-20 border border-gray-200">
                                  <div className="py-1">
                                    <button
                                      onClick={() => handleEditItem(item)}
                                      className="flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                    >
                                      <Edit size={14} className="mr-2" />
                                      Edit Item
                                    </button>
                                    <button
                                      onClick={() => handleDeleteItem(item)}
                                      className="flex items-center w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                                    >
                                      <Trash size={14} className="mr-2" />
                                      Delete Item
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Item Details Grid */}
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <span className="text-gray-500">Quantity:</span>
                              <div className="flex items-center mt-1">
                                <span className={`font-medium ${item.quantity <= item.lowStockThreshold ? "text-amber-700" : "text-gray-900"}`}>
                                  {item.quantity} {activeTab === "retail" ? "pcs" : "packets"}
                                </span>
                                {item.quantity <= item.lowStockThreshold && (
                                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                                    <AlertCircle size={10} className="mr-1" />
                                    Low
                                  </span>
                                )}
                              </div>
                            </div>

                            <div>
                              <span className="text-gray-500">Unit Price:</span>
                              <p className="font-medium text-gray-900 mt-1">
                                ${item.unitPrice ? item.unitPrice.toFixed(2) : "0.00"}
                              </p>
                            </div>
                          </div>

                          {/* Total Value */}
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <div className="flex justify-between items-center">
                              <span className="text-gray-500 text-sm">Total Value:</span>
                              <span className="font-semibold text-lg text-gray-900">
                                ${totalValue.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-8 text-center text-gray-500">
                    <Package size={48} className="mx-auto mb-4 text-gray-400" />
                    <p className="text-lg">No stock items found</p>
                    <p className="text-sm mt-1">
                      {searchQuery ? "Try changing your search query" : "Start by adding some items to your inventory"}
                    </p>
                    <button
                      onClick={() => {
                        setItemToEdit(null);
                        setIsAddModalOpen(true);
                      }}
                      className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      Add New Item
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Mobile-only Add Item Button at Bottom */}
          <div className="md:hidden mt-6 px-4">
            <button
              onClick={() => {
                setItemToEdit(null);
                setIsAddModalOpen(true);
              }}
              className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <Plus size={16} className="mr-1" />
              Add Item
            </button>
          </div>

        </main>
      </div>

      {/* AddStock Modal */}
      <AddStockModal
        isOpen={isAddModalOpen}
        onClose={handleAddModalClose}
        onStockAdded={fetchData}
        editItem={itemToEdit}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDeleteItem}
        itemDetails={itemToDelete}
      />
    </div>
  );
}

export default StockPage;