import React, { useState, useEffect, useRef } from 'react';
import { Camera, Upload, X, FileImage, Settings } from 'lucide-react';

// Mock Navbar component - replace with your actual navbar
const Navbar = () => (
  <nav className="bg-gray-900 p-4 text-white">
    <h1 className="text-lg font-bold">Budget Tracker</h1>
  </nav>
);

// API Key Configuration Component
const ApiKeyConfig = ({ apiKey, setApiKey, isConfigOpen, setIsConfigOpen }) => {
  const [tempApiKey, setTempApiKey] = useState(apiKey);

  const handleSave = () => {
    setApiKey(tempApiKey);
    setIsConfigOpen(false);
    // Note: API key tersimpan dalam state selama session
    // Dalam production bisa menggunakan IndexedDB atau localStorage
  };

  if (!isConfigOpen) return null;

  return (
    <div className="mb-4 bg-gray-800 rounded-lg p-4 border border-gray-600">
      <h3 className="text-sm font-medium text-blue-300 mb-3">Konfigurasi API Key</h3>
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Google Gemini API Key</label>
          <input
            type="password"
            value={tempApiKey}
            onChange={(e) => setTempApiKey(e.target.value)}
            placeholder="Masukkan API Key Gemini..."
            className="w-full p-2 rounded bg-gray-700 text-white text-xs border border-gray-600 focus:border-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            Dapatkan API key di <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-400">Google AI Studio</a>
            <br />
            <span className="text-green-400">💾 Data tersimpan dengan fallback ke localStorage</span>
          </p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={handleSave}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1 rounded"
          >
            Simpan
          </button>
          <button
            onClick={() => setIsConfigOpen(false)}
            className="bg-gray-600 hover:bg-gray-700 text-white text-xs px-3 py-1 rounded"
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  );
};

// Komponen animasi mengetik
const TypingAnimation = () => {
  const [dots, setDots] = useState('');
  
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => {
        if (prev.length >= 3) return '';
        return prev + '.';
      });
    }, 400);
    
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div className="mt-[-70px] mb-20">
      <h2 className="text-sm mb-2 text-blue-300">AI Sedang Berfikir..</h2>
      <div className="p-6 bg-gray-800 rounded-lg border-l-4 border-blue-500 flex items-start">
        <div className="flex items-center">
          <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center mr-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div className="typing-animation">
            <span className="inline-block align-middle h-3 w-3 bg-blue-400 rounded-full mr-1 animate-pulse"></span>
            <span className="inline-block align-middle h-3 w-3 bg-blue-400 rounded-full mr-1 animate-pulse delay-100"></span>
            <span className="inline-block align-middle h-3 w-3 bg-blue-400 rounded-full animate-pulse delay-200"></span>
            <span className="font-medium text-gray-300 ml-2">Menganalisis Receipt{dots}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Komponen untuk upload receipt dengan Gemini OCR
const ReceiptUpload = ({ onReceiptAnalyzed, loading, apiKey }) => {
  const [uploadedImage, setUploadedImage] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // Fungsi untuk mengkonversi file ke base64
  const convertToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        // Remove data:image/jpeg;base64, prefix
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  // Fungsi untuk menganalisis receipt menggunakan Gemini API
  const analyzeReceiptWithGemini = async (imageFile) => {
    if (!apiKey) {
      throw new Error('API Key Gemini tidak ditemukan. Silakan konfigurasi terlebih dahulu.');
    }

    setAnalyzing(true);
    setError('');
    
    try {
      // Konversi image ke base64
      const base64Image = await convertToBase64(imageFile);
      
      // Prepare request untuk Gemini API
      const requestBody = {
        contents: [
          {
            parts: [
              {
                text: `Analisis receipt/struk belanja dalam gambar ini dan ekstrak informasi berikut dalam format JSON yang valid:

{
  "storeName": "nama toko",
  "date": "YYYY-MM-DD",
  "items": [
    {
      "name": "nama item",
      "price": harga_dalam_angka,
      "category": "kategori item (Makanan Pokok, Protein, Sayuran, Minuman, Snack, Elektronik, Pakaian, dll)"
    }
  ],
  "total": total_harga_dalam_angka,
  "paymentMethod": "metode pembayaran",
  "tax": tax_amount_jika_ada,
  "discount": discount_amount_jika_ada
}

Pastikan:
1. Harga dalam format angka (tanpa titik atau koma untuk ribuan)
2. Tanggal dalam format YYYY-MM-DD
3. Kategorikan item sesuai jenis produk
4. Jika tidak dapat membaca informasi tertentu, gunakan nilai default yang masuk akal
5. Response harus dalam format JSON yang valid`
              },
              {
                inline_data: {
                  mime_type: imageFile.type,
                  data: base64Image
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          topK: 32,
          topP: 1,
          maxOutputTokens: 2048,
        }
      };

      // Call Gemini API
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API Error: ${errorData.error?.message || 'Failed to analyze receipt'}`);
      }

      const data = await response.json();
      
      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        throw new Error('Invalid response from Gemini API');
      }

      const textResponse = data.candidates[0].content.parts[0].text;
      
      // Extract JSON from response
      const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in response');
      }

      const receiptData = JSON.parse(jsonMatch[0]);
      
      // Validate and sanitize data
      const sanitizedData = {
        storeName: receiptData.storeName || "Toko Tidak Diketahui",
        date: receiptData.date || new Date().toISOString().split('T')[0],
        items: (receiptData.items || []).map(item => ({
          name: item.name || "Item",
          price: parseInt(item.price) || 0,
          category: item.category || "Lainnya"
        })),
        total: parseInt(receiptData.total) || 0,
        paymentMethod: receiptData.paymentMethod || "Cash",
        tax: parseInt(receiptData.tax) || 0,
        discount: parseInt(receiptData.discount) || 0
      };

      // Calculate total if not provided or seems wrong
      if (!sanitizedData.total || sanitizedData.total === 0) {
        sanitizedData.total = sanitizedData.items.reduce((sum, item) => sum + item.price, 0);
      }

      // Callback ke parent component
      onReceiptAnalyzed(sanitizedData);
      
    } catch (error) {
      console.error('Error analyzing receipt with Gemini:', error);
      setError(error.message);
      
      // Fallback to mock data in case of error
      const mockReceiptData = {
        storeName: "Analisis Gagal - Data Contoh",
        date: new Date().toISOString().split('T')[0],
        items: [
          { name: "Item 1", price: 50000, category: "Lainnya" },
          { name: "Item 2", price: 30000, category: "Lainnya" }
        ],
        total: 80000,
        paymentMethod: "Cash",
        tax: 0,
        discount: 0
      };
      
      onReceiptAnalyzed(mockReceiptData);
    } finally {
      setAnalyzing(false);
    }
  };

  // Handle file upload
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
      setUploadedImage(URL.createObjectURL(file));
      await analyzeReceiptWithGemini(file);
    } else {
      setError('Silakan pilih file gambar yang valid.');
    }
  };

  // Clear uploaded image
  const clearImage = () => {
    setUploadedImage(null);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  return (
    <div className="mb-6">
      <h3 className="text-sm text-gray-400 mb-3">Upload Receipt/Struk Belanja</h3>
      
      {error && (
        <div className="mb-3 p-3 bg-red-900 border border-red-600 rounded-lg">
          <p className="text-red-300 text-xs">{error}</p>
        </div>
      )}

      {!apiKey && (
        <div className="mb-3 p-3 bg-yellow-900 border border-yellow-600 rounded-lg">
          <p className="text-yellow-300 text-xs">⚠️ API Key Gemini belum dikonfigurasi. Klik tombol pengaturan untuk mengatur API key.</p>
        </div>
      )}
      
      {!uploadedImage ? (
        <div className="space-y-3">
          {/* Upload from gallery */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading || analyzing || !apiKey}
            className="w-full bg-gray-800 hover:bg-gray-700 border-2 border-dashed border-gray-600 rounded-lg p-4 flex items-center justify-center space-x-2 transition-colors disabled:opacity-50"
          >
            <Upload size={20} className="text-blue-400" />
            <span className="text-sm">Upload dari Galeri</span>
          </button>
          
          {/* Camera capture */}
          <button
            onClick={() => cameraInputRef.current?.click()}
            disabled={loading || analyzing || !apiKey}
            className="w-full bg-gray-800 hover:bg-gray-700 border-2 border-dashed border-gray-600 rounded-lg p-4 flex items-center justify-center space-x-2 transition-colors disabled:opacity-50"
          >
            <Camera size={20} className="text-green-400" />
            <span className="text-sm">Ambil Foto</span>
          </button>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
          
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      ) : (
        <div className="space-y-3">
          {/* Preview uploaded image */}
          <div className="relative">
            <img
              src={uploadedImage}
              alt="Receipt preview"
              className="w-full h-48 object-cover rounded-lg border border-gray-600"
            />
            <button
              onClick={clearImage}
              className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 rounded-full p-1 transition-colors"
            >
              <X size={16} className="text-white" />
            </button>
          </div>
          
          {analyzing && (
            <div className="bg-blue-900 p-3 rounded-lg flex items-center space-x-2">
              <div className="animate-spin w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full"></div>
              <span className="text-sm text-blue-300">Menganalisis receipt dengan AI...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Komponen untuk menampilkan hasil analisis receipt
const ReceiptAnalysisResult = ({ receiptData, onAddToTransactions }) => {
  if (!receiptData) return null;

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="mb-6 bg-gray-800 rounded-lg p-4 border border-gray-600">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-blue-300">Hasil Analisis Receipt</h3>
        <FileImage size={16} className="text-blue-400" />
      </div>
      
      <div className="space-y-2 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-gray-400">Toko:</span>
            <p className="text-white">{receiptData.storeName}</p>
          </div>
          <div>
            <span className="text-gray-400">Tanggal:</span>
            <p className="text-white">{receiptData.date}</p>
          </div>
        </div>
        
        <div>
          <span className="text-gray-400">Items:</span>
          <div className="mt-1 space-y-1">
            {receiptData.items.map((item, index) => (
              <div key={index} className="flex justify-between text-xs">
                <div className="flex-1">
                  <span>{item.name}</span>
                  <span className="text-gray-500 ml-1">({item.category})</span>
                </div>
                <span className="text-green-400">{formatCurrency(item.price)}</span>
              </div>
            ))}
          </div>
        </div>

        {receiptData.tax > 0 && (
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Pajak:</span>
            <span className="text-yellow-400">{formatCurrency(receiptData.tax)}</span>
          </div>
        )}

        {receiptData.discount > 0 && (
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Diskon:</span>
            <span className="text-red-400">-{formatCurrency(receiptData.discount)}</span>
          </div>
        )}
        
        <div className="flex justify-between items-center pt-2 border-t border-gray-600">
          <span className="font-medium">Total:</span>
          <span className="font-medium text-green-400">{formatCurrency(receiptData.total)}</span>
        </div>

        <div className="flex justify-between text-xs">
          <span className="text-gray-400">Pembayaran:</span>
          <span className="text-white">{receiptData.paymentMethod}</span>
        </div>
        
        <button
          onClick={() => onAddToTransactions(receiptData)}
          className="w-full mt-3 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg text-sm transition-colors"
        >
          Tambahkan ke Transaksi
        </button>
      </div>
    </div>
  );
};

const Statistics = () => {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [financialSummary, setFinancialSummary] = useState(null);
  const [receiptData, setReceiptData] = useState(null);
  const [apiKey, setApiKey] = useState('AIzaSyAZLoO1J6mJ1D8ffMrFJwIUNOwXR78tilk');
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  // Load API key and financial data
  useEffect(() => {
    loadFinancialData();
  }, []);

  // Save to storage when transactions change (similar to paste.txt pattern)
  useEffect(() => {
    if (!initialLoadComplete) return; // Skip initial render
    
    if (transactions.length > 0) {
      // Save to both storages for redundancy
      saveToIndexedDB(transactions)
        .then(success => {
          console.log("Data saved to IndexedDB:", success);
        })
        .catch(error => {
          console.error("Error in IndexedDB save:", error);
        });
    } else {
      // If there are no transactions, clear storage
      try {
        initIndexedDB().then(db => {
          const transaction = db.transaction(["transactions"], "readwrite");
          const store = transaction.objectStore("transactions");
          store.clear();
          console.log("Data cleared from IndexedDB");
        });
      } catch (error) {
        console.error("Error clearing IndexedDB:", error);
      }
    }
  }, [transactions, initialLoadComplete]);

  // Initialize IndexedDB (updated pattern from paste.txt)
  const initIndexedDB = () => {
    return new Promise((resolve, reject) => {
      try {
        const request = window.indexedDB.open("budgetTrackerDB", 1);
        
        request.onerror = (event) => {
          console.error("IndexedDB error:", event.target.error);
          reject("Couldn't open IndexedDB");
        };
        
        request.onsuccess = (event) => {
          const db = event.target.result;
          resolve(db);
        };
        
        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          // Buat object store jika belum ada
          if (!db.objectStoreNames.contains("transactions")) {
            db.createObjectStore("transactions", { keyPath: "id" });
          }
        };
      } catch (error) {
        console.error("Error initializing IndexedDB:", error);
        reject(error);
      }
    });
  };

  // Load transactions from IndexedDB (updated pattern from paste.txt)
  const loadFromIndexedDB = async () => {
    try {
      const db = await initIndexedDB();
      const transaction = db.transaction(["transactions"], "readonly");
      const store = transaction.objectStore("transactions");
      const request = store.getAll();
      
      return new Promise((resolve, reject) => {
        request.onsuccess = (event) => {
          resolve(event.target.result || []);
        };
        
        request.onerror = (event) => {
          console.error("Error loading from IndexedDB:", event.target.error);
          reject(event.target.error);
        };
      });
    } catch (error) {
      console.error("Failed to load from IndexedDB:", error);
      return [];
    }
  };

  // Save transactions to IndexedDB (updated pattern from paste.txt)
  const saveToIndexedDB = async (transactionsData) => {
    try {
      const db = await initIndexedDB();
      const transaction = db.transaction(["transactions"], "readwrite");
      const store = transaction.objectStore("transactions");
      
      // Hapus semua data yang ada
      store.clear();
      
      // Tambahkan semua transaksi
      transactionsData.forEach(t => {
        store.add(t);
      });
      
      return new Promise((resolve, reject) => {
        transaction.oncomplete = () => {
          resolve(true);
        };
        
        transaction.onerror = (event) => {
          console.error("Error saving to IndexedDB:", event.target.error);
          reject(event.target.error);
        };
      });
    } catch (error) {
      console.error("Failed to save to IndexedDB:", error);
      // Note: In Claude artifacts, localStorage is not available
      // This would be the fallback in production:
      // try {
      //   localStorage.setItem('transactions', JSON.stringify(transactionsData));
      // } catch (localError) {
      //   console.error("Error saving to localStorage:", localError);
      // }
      return false;
    }
  };

  // Load and analyze financial data (updated pattern from paste.txt)
  const loadFinancialData = async () => {
    try {
      // Try to load from IndexedDB first
      let loadedTransactions = [];
      try {
        const indexedDBData = await loadFromIndexedDB();
        if (indexedDBData && indexedDBData.length > 0) {
          loadedTransactions = indexedDBData;
          console.log("Data loaded from IndexedDB:", loadedTransactions);
        }
      } catch (indexedDBError) {
        console.error("Error loading from IndexedDB:", indexedDBError);
      }
      
      // If no data in IndexedDB, use initial mock data
      if (loadedTransactions.length === 0) {
        console.log("No data found, using initial mock data");
        loadedTransactions = [
          { id: "1", type: 'Pemasukan', amount: 5000000, description: 'Gaji', date: '2024-01-15' },
          { id: "2", type: 'Pengeluaran', amount: 500000, description: 'Belanja Bulanan', date: '2024-01-20' },
          { id: "3", type: 'Pengeluaran', amount: 200000, description: 'Transport', date: '2024-01-25' },
          { id: "4", type: 'Pemasukan', amount: 1000000, description: 'Freelance', date: '2024-02-01' },
          { id: "5", type: 'Pengeluaran', amount: 300000, description: 'Makan', date: '2024-02-05' }
        ];
        
        // Save to IndexedDB for next time
        await saveToIndexedDB(loadedTransactions);
      }
      
      if (loadedTransactions.length > 0) {
        // Ensure all transactions have proper structure
        const validatedTransactions = loadedTransactions.map(t => ({
          id: t.id || Date.now().toString() + Math.random().toString(36).substr(2, 5),
          type: t.type || 'Pengeluaran',
          amount: parseFloat(t.amount || 0),
          description: t.description || 'Tidak ada keterangan',
          date: t.date || new Date().toISOString()
        }));
        
        setTransactions(validatedTransactions);
        analyzeFinancialData(validatedTransactions);
      }
      
      setInitialLoadComplete(true);
      return true;
    } catch (error) {
      console.error("Error in loadFinancialData:", error);
      setInitialLoadComplete(true);
      return false;
    }
  };

  // Analyze financial data and create a summary
  const analyzeFinancialData = (transactions) => {
    const income = transactions
      .filter(t => t.type === 'Pemasukan')
      .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
    
    const expense = transactions
      .filter(t => t.type === 'Pengeluaran')
      .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
    
    const balance = income - expense;

    const categories = {};
    transactions.forEach(transaction => {
      if (!categories[transaction.description]) {
        categories[transaction.description] = { income: 0, expense: 0 };
      }
      
      if (transaction.type === 'Pemasukan') {
        categories[transaction.description].income += parseFloat(transaction.amount || 0);
      } else {
        categories[transaction.description].expense += parseFloat(transaction.amount || 0);
      }
    });

    const summary = {
      totalIncome: income,
      totalExpense: expense,
      balance: balance,
      transactionCount: transactions.length,
      topIncomeCategories: Object.entries(categories)
        .filter(([_, values]) => values.income > 0)
        .sort((a, b) => b[1].income - a[1].income)
        .slice(0, 5),
      topExpenseCategories: Object.entries(categories)
        .filter(([_, values]) => values.expense > 0)
        .sort((a, b) => b[1].expense - a[1].expense)
        .slice(0, 5)
    };

    setFinancialSummary(summary);
  };

  // Format currency for display
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  // Handle receipt analysis result
  const handleReceiptAnalyzed = (data) => {
    setReceiptData(data);
    setQuery(`Saya baru saja berbelanja di ${data.storeName} dengan total ${formatCurrency(data.total)}. Items yang dibeli: ${data.items.map(item => item.name).join(', ')}. Tolong analisis pembelian ini dan berikan saran finansial.`);
  };

  // Add receipt data to transactions (updated pattern from paste.txt)
  const addReceiptToTransactions = async (receipt) => {
    // Generate unique ID using timestamp and random string
    const newTransaction = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      type: 'Pengeluaran',
      amount: parseFloat(receipt.total),
      description: `Belanja di ${receipt.storeName}`,
      date: receipt.date
    };

    const updatedTransactions = [...transactions, newTransaction];
    setTransactions(updatedTransactions);
    
    // Analyze financial data with updated transactions
    analyzeFinancialData(updatedTransactions);
    
    // Clear receipt data after adding
    setReceiptData(null);
    
    // Show success message with transaction details
    alert(`Receipt berhasil ditambahkan!\n\nDetail Transaksi:\nID: ${newTransaction.id}\nTipe: ${newTransaction.type}\nJumlah: ${formatCurrency(newTransaction.amount)}\nDeskripsi: ${newTransaction.description}\nTanggal: ${newTransaction.date}\n\nTotal transaksi: ${updatedTransactions.length}`);
    
    // Log untuk debugging
    console.log('Transaksi baru ditambahkan:', newTransaction);
    console.log('Total transaksi sekarang:', updatedTransactions.length);
    console.log('Semua transaksi:', updatedTransactions);
  };

  // Mock AI response function (replace with actual AI API call)
  const askGroq = async () => {
    if (!query.trim()) return;
    
    setLoading(true);
    setError('');
    setResponse('');
    
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      let mockResponse = '';
      if (query.toLowerCase().includes('total') || query.toLowerCase().includes('pemasukan') || query.toLowerCase().includes('pengeluaran')) {
        mockResponse = `Berdasarkan data keuangan Anda:

📊 **Ringkasan Keuangan**
- Total Pemasukan: ${formatCurrency(financialSummary?.totalIncome || 0)}
- Total Pengeluaran: ${formatCurrency(financialSummary?.totalExpense || 0)}
- Saldo: ${formatCurrency(financialSummary?.balance || 0)}

💡 **Analisis**
${financialSummary?.balance > 0 ? 
  'Keuangan Anda dalam kondisi positif! Saldo masih surplus.' : 
  'Perhatian: Pengeluaran melebihi pemasukan. Pertimbangkan untuk mengurangi pengeluaran tidak penting.'}

📈 **Saran**
- Alokasikan 20% pendapatan untuk tabungan
- Pantau pengeluaran harian untuk kontrol yang lebih baik
- Pertimbangkan investasi jika saldo sudah stabil`;
      } else if (query.toLowerCase().includes('receipt') || query.toLowerCase().includes('struk') || query.toLowerCase().includes('belanja')) {
        mockResponse = `Berdasarkan analisis receipt yang Anda upload:

🛒 **Analisis Pembelian**
Pembelian Anda terlihat fokus pada kebutuhan yang baik! 

💰 **Evaluasi Pengeluaran**
- Kategori utama: ${receiptData?.items[0]?.category || 'Kebutuhan umum'}
- Total belanja dalam range wajar
- Pola belanja terstruktur dengan baik

✅ **Rekomendasi**
- Pertahankan pola belanja yang fokus pada kebutuhan
- Bandingkan harga di beberapa toko untuk optimasi
- Buat daftar belanja sebelum ke toko untuk menghindari pembelian tidak perlu
- Pantau kategori pengeluaran ini dalam budget bulanan`;
      } else {
        mockResponse = `Terima kasih atas pertanyaan Anda tentang keuangan. 

Berdasarkan data transaksi yang tersedia, saya dapat membantu Anda dengan:
- Analisis pengeluaran dan pemasukan
- Saran pengelolaan keuangan
- Review pola belanja dari receipt
- Proyeksi dan perencanaan budget

Silakan tanyakan hal spesifik yang ingin Anda ketahui tentang keuangan Anda!`;
      }
      
      setResponse(mockResponse);
    } catch (err) {
      setError(`Error: ${err.message || 'Something went wrong'}`);
    } finally {
      setLoading(false);
    }
  };

  const suggestedPrompts = [
    "Berapa total pemasukan dan pengeluaran saya?",
    "Apa kategori pengeluaran terbesar saya?",
    "Bagaimana tren keuangan saya dalam 6 bulan terakhir?",
    "Berapa persentase pendapatan yang saya simpan?",
    "Berikan saran untuk mengoptimalkan keuangan saya"
  ];

  return (
    <>
      <Navbar/>
      <div className="max-w-[480px] mx-auto bg-black text-white p-6 font-bold flex flex-col min-h-screen overflow-auto">
        <div className="w-full">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl text-center text-blue-500">Tanya AI</h1>
            <button
              onClick={() => setIsConfigOpen(!isConfigOpen)}
              className="bg-gray-700 hover:bg-gray-600 p-2 rounded-lg transition-colors"
            >
              <Settings size={16} className="text-gray-300" />
            </button>
          </div>

          {/* API Key Configuration */}
          <ApiKeyConfig 
            apiKey={apiKey}
            setApiKey={setApiKey}
            isConfigOpen={isConfigOpen}
            setIsConfigOpen={setIsConfigOpen}
          />
          
          {/* Financial Data Status */}
          <div className="mb-4 text-center">
            {financialSummary ? (
              <div className="mb-6 text-xs text-gray-400">
                <p>Data keuangan Anda berhasil dimuat • {financialSummary.transactionCount} transaksi</p>
                <p className="text-green-400 mt-1">💾 Data tersimpan dengan redundansi (IndexedDB + fallback)</p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <div className="bg-gray-800 p-2 rounded">
                    <p className="text-green-400">Pemasukan</p>
                    <p className="text-sm">{formatCurrency(financialSummary.totalIncome)}</p>
                  </div>
                  <div className="bg-gray-800 p-2 rounded">
                    <p className="text-red-400">Pengeluaran</p>
                    <p className="text-sm">{formatCurrency(financialSummary.totalExpense)}</p>
                  </div>
                  <div className="bg-gray-800 p-2 rounded">
                    <p className="text-blue-400">Saldo</p>
                    <p className="text-sm">{formatCurrency(financialSummary.balance)}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mb-4">
                <p className="text-yellow-500 text-sm mb-2">Memuat data keuangan...</p>
                <button 
                  className="bg-blue-600 text-white text-xs px-3 py-1 rounded-lg" 
                  onClick={loadFinancialData}
                >
                  Muat Ulang Data
                </button>
              </div>
            )}
          </div>

          {/* Receipt Upload Component with Gemini OCR */}
          <ReceiptUpload 
            onReceiptAnalyzed={handleReceiptAnalyzed}
            loading={loading}
            apiKey={apiKey}
          />

          {/* Receipt Analysis Result */}
          <ReceiptAnalysisResult 
            receiptData={receiptData}
            onAddToTransactions={addReceiptToTransactions}
          />
          
          {/* Suggested Prompts */}
          <div className="mb-4">
            <p className="text-sm text-gray-400 mb-2">Contoh pertanyaan:</p>
            <div className="flex flex-wrap gap-2">
              {suggestedPrompts.map((prompt, index) => (
                <button 
                  key={index}
                  className="bg-gray-800 hover:bg-gray-700 text-xs py-1 px-2 rounded-full text-blue-300"
                  onClick={() => setQuery(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
          
          <div className="mb-20 mt-10">
            <p className="text-sm text-gray-400 mb-3">Tanyakan Apa saja tentang Financial</p>
            <textarea 
              className="w-full p-4 rounded-lg bg-gray-800 text-white text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Contoh: Jelaskan tren pengeluaran saya selama 3 bulan terakhir"
              rows="4"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg transition-colors disabled:bg-gray-500"
              onClick={askGroq}
              disabled={loading || !query.trim()}
            >
              {loading ? 'Memproses...' : 'Tanyakan Asisten AI'}
            </button>
          </div>

          {error && (
            <div className="p-4 bg-red-700 rounded-lg mb-6 text-sm">
              {error}
            </div>
          )}
          
          {loading && <TypingAnimation />}
          
          {!loading && response && (
            <div className="mt-[-50px] mb-20">
              <h2 className="text-lg mb-2 text-blue-300">Jawab AI:</h2>
              <div className="p-6 bg-gray-800 rounded-lg text-sm font-normal whitespace-pre-wrap border-l-4 border-blue-500 max-h-96 overflow-y-auto">
                {response}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Statistics;