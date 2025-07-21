import React, { useState, useCallback } from 'react';
import { Copy, Download, Eye, Trash2, Settings, FileText } from 'lucide-react';
import Head from 'next/head';

export default function KeywordGrouper() {
  const [inputText, setInputText] = useState('');
  const [result, setResult] = useState('');
  const [threshold, setThreshold] = useState(85);
  const [stats, setStats] = useState({ total: 0, groups: 0, grouped: 0 });
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState([]);

  const similarity = (a, b) => {
    const longer = a.length > b.length ? a : b;
    const shorter = a.length > b.length ? b : a;
    const editDistance = getEditDistance(longer, shorter);
    if (longer.length === 0) return 1.0;
    return (longer.length - editDistance) / longer.length;
  };

  const getEditDistance = (s1, s2) => {
    s1 = s1.toLowerCase();
    s2 = s2.toLowerCase();
    const costs = [];
    for (let i = 0; i <= s2.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s1.length; j++) {
        if (i === 0) {
          costs[j] = j;
        } else {
          if (j > 0) {
            let newValue = costs[j - 1];
            if (s1.charAt(j - 1) !== s2.charAt(i - 1))
              newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
            costs[j - 1] = lastValue;
            lastValue = newValue;
          }
        }
      }
      if (i > 0) costs[s1.length] = lastValue;
    }
    return costs[s1.length];
  };

  const normalizeText = (text) => {
    text = text.replace(/\s+/g, ' ').trim();
    text = text.replace(/d'un/g, '').replace(/d'une/g, '');
    text = text.replace(/ à /g, ' ').replace(/ a /g, ' ');
    return text.replace(/\s+/g, ' ').trim();
  };

  const parseKeywords = (text) => {
    const lines = text.split('\n').filter(line => line.trim());
    const keywords = [];
    
    for (const line of lines) {
      const parts = line.split('\t');
      if (parts.length >= 2) {
        const keyword = parts[0].trim();
        const value = parseInt(parts[1].trim());
        if (!isNaN(value)) {
          keywords.push({ keyword, value });
        }
      }
    }
    
    return keywords;
  };

  const groupKeywords = (keywords) => {
    const groups = [];
    const usedIndices = new Set();
    const similarityThreshold = threshold / 100;

    for (let i = 0; i < keywords.length; i++) {
      if (usedIndices.has(i)) continue;

      const group = [keywords[i]];
      usedIndices.add(i);
      const currentNormalized = normalizeText(keywords[i].keyword);

      for (let j = 0; j < keywords.length; j++) {
        if (usedIndices.has(j)) continue;

        const otherNormalized = normalizeText(keywords[j].keyword);
        const simScore = similarity(currentNormalized, otherNormalized);

        if (simScore >= similarityThreshold) {
          group.push(keywords[j]);
          usedIndices.add(j);
        }
      }

      group.sort((a, b) => b.value - a.value);
      groups.push(group);
    }

    groups.sort((a, b) => b[0].value - a[0].value);
    return groups;
  };

  const processKeywords = useCallback(() => {
    if (!inputText.trim()) return;

    const keywords = parseKeywords(inputText);
    if (keywords.length === 0) return;

    const groups = groupKeywords(keywords);
    
    const resultLines = groups.map(group => 
      group.map(item => `${item.keyword}\t${item.value}`).join('\t\t')
    );

    const resultText = resultLines.join('\n');
    setResult(resultText);

    const groupedCount = groups.reduce((acc, group) => acc + (group.length > 1 ? group.length : 0), 0);
    setStats({
      total: keywords.length,
      groups: groups.length,
      grouped: groupedCount
    });
  }, [inputText, threshold]);

  const generatePreview = useCallback(() => {
    if (!inputText.trim()) return;

    const keywords = parseKeywords(inputText);
    if (keywords.length === 0) return;

    const groups = groupKeywords(keywords);
    const multiItemGroups = groups.filter(group => group.length > 1);
    
    setPreviewData(multiItemGroups);
    setShowPreview(true);
  }, [inputText, threshold]);

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      const button = document.activeElement;
      const originalText = button.textContent;
      button.textContent = 'Copié !';
      button.style.backgroundColor = '#10b981';
      setTimeout(() => {
        button.textContent = originalText;
        button.style.backgroundColor = '';
      }, 2000);
    } catch (err) {
      console.error('Erreur de copie:', err);
    }
  };

  const exportToCsv = () => {
    if (!result) return;

    const lines = result.split('\n').filter(line => line.trim());
    let csvContent = 'Mot-clé principal,Valeur principale,Mot-clé 2,Valeur 2,Mot-clé 3,Valeur 3,Mot-clé 4,Valeur 4\n';
    
    lines.forEach(line => {
      const items = line.split('\t\t');
      const csvRow = [];
      
      items.forEach(item => {
        const parts = item.split('\t');
        csvRow.push(`"${parts[0]}"`, parts[1] || '');
      });
      
      while (csvRow.length < 8) {
        csvRow.push('');
      }
      
      csvContent += csvRow.join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'mots-cles-groupes.csv');
    link.click();
  };

  const clearAll = () => {
    setInputText('');
    setResult('');
    setStats({ total: 0, groups: 0, grouped: 0 });
    setShowPreview(false);
    setPreviewData([]);
  };

  return (
    <>
      <Head>
        <title>Regroupeur de Mots-Clés</title>
        <meta name="description" content="Identifiez et regroupez automatiquement vos mots-clés similaires" />
        <link rel="icon" href="/favicon.ico" />
        <script src="https://cdn.tailwindcss.com"></script>
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-2 flex items-center justify-center gap-3">
              <FileText className="text-blue-600" size={40} />
              Regroupeur de Mots-Clés
            </h1>
            <p className="text-gray-600">Identifiez et regroupez automatiquement vos mots-clés similaires</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <Settings className="text-gray-600" size={20} />
                <h2 className="text-xl font-semibold text-gray-800">Configuration</h2>
              </div>
              
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Seuil de similarité: {threshold}%
                </label>
                <input
                  type="range"
                  min="50"
                  max="95"
                  value={threshold}
                  onChange={(e) => setThreshold(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>50% (Flexible)</span>
                  <span>95% (Strict)</span>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mots-clés (format: motclef[TAB]valeur)
                </label>
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="tarif coiffeur bayonne	2800&#10;tarif d'un coiffeur bayonne	1800&#10;tarif d'un coiffeur a bayonne	800&#10;devis elagage a bayonne	800&#10;banque en ligne	600"
                  className="w-full h-64 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-mono text-sm"
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={generatePreview}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                >
                  <Eye size={16} />
                  Prévisualiser
                </button>
                <button
                  onClick={processKeywords}
                  className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  <Settings size={16} />
                  Regrouper
                </button>
                <button
                  onClick={clearAll}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                >
                  <Trash2 size={16} />
                  Effacer
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-800">Résultats</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => copyToClipboard(result)}
                    disabled={!result}
                    className="flex items-center gap-2 px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Copy size={16} />
                    Copier
                  </button>
                  <button
                    onClick={exportToCsv}
                    disabled={!result}
                    className="flex items-center gap-2 px-3 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Download size={16} />
                    CSV
                  </button>
                </div>
              </div>

              {stats.total > 0 && (
                <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="text-center">
                      <div className="font-bold text-blue-600">{stats.total}</div>
                      <div className="text-gray-600">Total</div>
                    </div>
                    <div className="text-center">
                      <div className="font-bold text-green-600">{stats.groups}</div>
                      <div className="text-gray-600">Groupes</div>
                    </div>
                    <div className="text-center">
                      <div className="font-bold text-orange-600">{stats.grouped}</div>
                      <div className="text-gray-600">Regroupés</div>
                    </div>
                  </div>
                </div>
              )}

              <textarea
                value={result}
                readOnly
                placeholder="Le résultat apparaîtra ici..."
                className="w-full h-64 p-4 border border-gray-300 rounded-lg bg-gray-50 font-mono text-sm resize-none"
              />
            </div>
          </div>

          <div className="mt-8 bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Instructions d'utilisation</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-gray-600">
              <div>
                <h4 className="font-medium text-gray-800 mb-2">Format d'entrée :</h4>
                <ul className="space-y-1">
                  <li>• Un mot-clé par ligne</li>
                  <li>• Format: <code className="bg-gray-100 px-1 rounded">motclef[TAB]valeur</code></li>
                  <li>• Utilisez la touche Tab entre le mot-clé et la valeur</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-gray-800 mb-2">Fonctionnalités :</h4>
                <ul className="space-y-1">
                  <li>• Ajustez le seuil de similarité</li>
                  <li>• Prévisualisez les groupes détectés</li>
                  <li>• Exportez en CSV pour Excel</li>
                  <li>• Copiez directement le résultat</li>
                </ul>
              </div>
            </div>
          </div>

          {showPreview && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
                <div className="flex items-center justify-between p-6 border-b">
                  <h3 className="text-xl font-semibold text-gray-800">Prévisualisation des groupes</h3>
                  <button
                    onClick={() => setShowPreview(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <span className="text-2xl">&times;</span>
                  </button>
                </div>
                <div className="p-6 overflow-y-auto max-h-[60vh]">
                  {previewData.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">
                      Aucun groupe similaire trouvé avec ce seuil de {threshold}%.
                    </p>
                  ) : (
                    <div className="space-y-6">
                      {previewData.map((group, index) => (
                        <div key={index} className="border rounded-lg p-4 bg-gray-50">
                          <h4 className="font-medium text-gray-800 mb-3">Groupe {index + 1}</h4>
                          <div className="space-y-2">
                            {group.map((item, itemIndex) => (
                              <div key={itemIndex} className="flex justify-between items-center p-2 bg-white rounded border">
                                <span className="font-mono text-sm">{item.keyword}</span>
                                <span className="font-bold text-blue-600">{item.value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex justify-end p-6 border-t bg-gray-50">
                  <button
                    onClick={() => setShowPreview(false)}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Fermer
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}