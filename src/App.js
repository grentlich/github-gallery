import { useEffect, useState } from "react";
import { InformationCircleIcon, ArrowDownTrayIcon, XMarkIcon } from '@heroicons/react/24/solid';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import 'github-markdown-css/github-markdown.css';
import './iframe.css';

const REPO_OWNER = "lumapps-marketplace";
const REPO_NAME = "lumapps-extension-code-sample";
const FOLDER_PATH = "micro-app/micro-app/Plug%20and%20play";
const API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FOLDER_PATH}`;

const markdownStyles = {
  ul: { listStyleType: 'disc', paddingLeft: '2em' },
  ol: { listStyleType: 'decimal', paddingLeft: '2em' }
};

export default function GitHubGallery() {
  const [items, setItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReadme, setSelectedReadme] = useState(null);
  const [readmeContent, setReadmeContent] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);

  const handleTagClick = (tag) => {
    setSelectedTags(prev => 
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const getAllTags = () => {
    const allTags = items.flatMap(item => {
      const { tags } = extractTitleAndTags(item.name);
      return tags;
    });
    return [...new Set(allTags)].sort();
  };

  const extractTitleAndTags = (name) => {
    const tagMatches = name.match(/\[(.*?)\]/g) || [];
    const title = name.replace(/\[.*?\]/g, '').trim();
    const tags = tagMatches.map(tag => tag.slice(1, -1).trim());
    return { title, tags };
  };

  const filteredItems = items.filter(item => {
    const { title, tags } = extractTitleAndTags(item.name);
    const searchLower = searchTerm.toLowerCase();
    
    // Recherche dans le titre ou dans les tags
    const matchesSearch = title.toLowerCase().includes(searchLower) || 
                         tags.some(tag => tag.toLowerCase().includes(searchLower));
    
    // Modification: Filtrage OR pour les tags sélectionnés (au lieu de AND)
    const matchesTags = selectedTags.length === 0 || 
                       selectedTags.some(selectedTag => tags.includes(selectedTag));
    
    return matchesSearch && matchesTags;
  });

  const handleCloseModal = () => {
    setSelectedReadme(null);
    setReadmeContent('');
  };

  const handleReadmeClick = async (item) => {
    if (!item.readme) return;
    
    try {
      const rawUrl = item.readme.replace('github.com', 'raw.githubusercontent.com').replace('/blob', '');
      const folderPath = item.preview?.substring(0, item.preview.lastIndexOf('/'));
      const response = await fetch(rawUrl);
      let content = await response.text();
      
      content = content.replace(
        /<img\s+src="([^"]+)"\s+[^>]*>/g,
        (match, imageName) => {
          const decodedName = decodeURIComponent(imageName);
          return `![${decodedName}](${folderPath}/${decodedName})`;
        }
      );
      
      setReadmeContent(content);
      setSelectedReadme(item);
    } catch (error) {
      console.error('Error fetching readme:', error);
    }
  };

  const handleDownload = async (jsonUrl, itemName) => {
    try {
      const response = await fetch(jsonUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const { title } = extractTitleAndTags(itemName);
      const fileName = `${title.toLowerCase().replace(/\s+/g, '-')}-config.json`;
      
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading file:', error);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      const headers = {
        Authorization: `token ${process.env.REACT_APP_GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
      };

      try {
        const res = await fetch(API_URL, { headers });
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        
        if (!Array.isArray(data)) {
          console.error('Received data:', data);
          throw new Error('API did not return an array');
        }
        
        const folders = data.filter((item) => item.type === "dir");
        const fetchDetails = folders.map(async (folder) => {
          const encodedFolderName = encodeURIComponent(folder.name);
          const folderPath = `${FOLDER_PATH}/${encodedFolderName}`;
          const folderUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${folderPath}`;
          
          // Récupérer les fichiers dans le dossier
          const filesRes = await fetch(folderUrl, { headers });
          if (!filesRes.ok) throw new Error(`HTTP error! status: ${filesRes.status}`);
          const files = await filesRes.json();
          
          const preview = files.find((file) => file.name.endsWith(".png"));
          const readme = files.find((file) => file.name.toLowerCase() === "readme.md");
          const jsonFile = files.find((file) => file.name.endsWith(".json"));
          
          // Récupérer l'historique des commits pour ce dossier spécifique
          const commitsUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/commits?path=${folderPath}`;
          const commitsRes = await fetch(commitsUrl, { headers });
          
          let createdAt = null;
          let lastUpdatedAt = null;
          
          if (commitsRes.ok) {
            const commits = await commitsRes.json();
            
            if (commits.length > 0) {
              // Le dernier commit (le plus récent) pour ce dossier
              lastUpdatedAt = new Date(commits[0].commit.committer.date);
              
              // Le premier commit (le plus ancien) pour ce dossier
              if (commits.length > 1) {
                // Si l'API renvoie plusieurs commits, prenons le dernier de la liste
                // Note: GitHub limite généralement les résultats, donc pour être précis
                // il faudrait paginer pour obtenir tous les commits
                const oldestCommitUrl = `${commitsUrl}&per_page=1&page=${commits.length}`;
                const oldestCommitRes = await fetch(oldestCommitUrl, { headers });
                
                if (oldestCommitRes.ok) {
                  const oldestCommits = await oldestCommitRes.json();
                  if (oldestCommits.length > 0) {
                    createdAt = new Date(oldestCommits[0].commit.committer.date);
                  }
                }
              } else {
                // S'il n'y a qu'un seul commit, c'est à la fois la date de création et de mise à jour
                createdAt = lastUpdatedAt;
              }
            }
          }
          
          return {
            name: folder.name,
            preview: preview ? preview.download_url : null,
            readme: readme ? readme.html_url.replace(/\[/g, '%5B').replace(/\]/g, '%5D') : null,
            jsonFile: jsonFile ? jsonFile.download_url.replace(/\[/g, '%5B').replace(/\]/g, '%5D') : null,
            createdAt,
            lastUpdatedAt
          };
        });
        
        const results = await Promise.all(fetchDetails);
        setItems(results);
      } catch (error) {
        console.error('Error fetching data:', error);
        setItems([]);
      }
    };

    fetchData();
  }, []);

// Ajouter cette fonction pour formater les dates
const formatDate = (date) => {
  if (!date) return 'Unknown';
  
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 1) {
    return 'Today';
  } else if (diffDays < 2) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months} ${months === 1 ? 'month' : 'months'} ago`;
  } else {
    return date.toLocaleDateString('fr-FR', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  }
};

  useEffect(() => {
    const handleEscapeKey = (e) => {
      if (e.key === 'Escape' && selectedReadme) {
        handleCloseModal();
      }
    };

    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [selectedReadme]);

  return (
    <div className="gallery-container min-h-screen bg-[#faf9f7]">
      <header className="bg-gradient-to-r from-[#2493ff] to-[#245be7] text-white py-12 px-6 mb-12 shadow-lg">
        <h1 className="text-2xl font-bold text-center text-white mb-4">
          LumApps Micro-app gallery
        </h1>
        <div className="max-w-xl mx-auto relative">
          <input
            type="text"
            value={searchTerm}
            placeholder="Search for a micro-app..."
            className="w-full px-4 py-2 rounded-lg bg-white/20 border border-white/30 
              text-white placeholder-white/70 focus:outline-none focus:border-white/50 
              focus:ring-2 focus:ring-white/20 transition-all duration-300"
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-white/70 hover:text-white text-xl font-bold"
            >
              ×
            </button>
          )}
        </div>

        <div className="max-w-4xl mx-auto mt-6">
          <div className="flex flex-wrap gap-2 justify-center">
            {getAllTags().map((tag) => (
              <button
                key={tag}
                onClick={() => handleTagClick(tag)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-all duration-200 
                  ${selectedTags.includes(tag)
                    ? 'bg-white text-[#245be7] shadow-md transform scale-105'
                    : 'bg-white/20 text-white hover:bg-white/30'}`}
              >
                {tag}
              </button>
            ))}
          </div>
          {selectedTags.length > 0 && (
            <button
              onClick={() => setSelectedTags([])}
              className="mt-3 text-white/70 hover:text-white text-sm mx-auto block"
            >
              Clear all filters
            </button>
          )}
        </div>
      </header>

      <div className="px-4 pb-12">
        <div className="columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6">
          {filteredItems.map((item) => {
            const { title, tags } = extractTitleAndTags(item.name);
            return (
              <div 
                key={item.name} 
                className="bg-white rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 relative group break-inside-avoid cursor-pointer"
                onClick={() => handleReadmeClick(item)}
              >
                {item.preview ? (
                  <div className="relative overflow-hidden bg-white rounded-t-lg border-b border-gray-200">
                    <img
                      src={item.preview}
                      alt={title}
                      className="w-full object-contain"
                      onLoad={(e) => {
                        const ratio = e.target.naturalHeight / e.target.naturalWidth;
                        e.target.style.height = `${e.target.offsetWidth * ratio}px`;
                      }}
                    />
                    <div className="absolute inset-0 bg-gray-900/75 opacity-0 group-hover:opacity-100 transition-all duration-300">
                      <div className="absolute bottom-4 right-4 flex gap-2">
                        {item.jsonFile && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(item.jsonFile, item.name);
                            }}
                            className="bg-white hover:bg-gray-100 p-2 rounded-lg transition-all duration-300 hover:shadow-md flex items-center justify-center w-10 h-10"
                            title="Download Configuration"
                          >
                            <ArrowDownTrayIcon className="w-7 h-7 text-[#245be7]" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-32 bg-white flex items-center justify-center rounded-t-lg border-b border-gray-200">
                    <span className="text-gray-400 text-sm">No preview available</span>
                  </div>
                )}
                <div className="p-4 bg-gradient-to-r from-[#245be7]/5 to-[#2493ff]/5 border-t border-[#245be7]/10">
                  <div className="flex justify-between items-start">
                    <h2 className="text-lg font-bold mb-2 text-gray-800">{title}</h2>
                    
                    {/* Affichage des dates sur la droite, l'un au-dessus de l'autre */}
                    <div className="flex flex-col items-end text-xs text-gray-500">
                      <div className="flex items-center mb-1">
                        <span className="mr-1">Created:</span>
                        <span className="font-medium">{formatDate(item.createdAt)}</span>
                      </div>
                      <div className="flex items-center">
                        <span className="mr-1">Updated:</span>
                        <span className="font-medium">{formatDate(item.lastUpdatedAt)}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-1">
                    {tags.map((tag, index) => (
                      <button 
                        key={index}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTagClick(tag);
                        }}
                        className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors duration-200 
                          ${selectedTags.includes(tag)
                            ? 'bg-[#245be7] text-white' 
                            : 'bg-[#91acf2]/20 hover:bg-[#91acf2]/30 text-[#245be7]'}`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedReadme && (
        <div 
          className="fixed inset-0 bg-gray-900/0 flex items-start justify-center pt-16 p-4 z-50 overflow-hidden
            animate-[fadeIn_0.3s_ease-out_forwards]"
          onClick={handleCloseModal}
          tabIndex={0}
        >
          <div 
            className="bg-white rounded-lg w-full max-w-4xl h-[90vh] max-h-[800px] flex flex-col shadow-xl
              opacity-0 scale-95 animate-[zoomIn_0.4s_ease-out_0.1s_forwards]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Reste du contenu de la modale */}
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800">Documentation</h2>
              <div className="flex items-center gap-3">
                {selectedReadme.jsonFile && (
                  <button
                    onClick={() => handleDownload(selectedReadme.jsonFile, selectedReadme.name)}
                    className="text-[#245be7] hover:text-[#1e4bc0] flex items-center gap-1"
                    title="Download Configuration"
                  >
                    <ArrowDownTrayIcon className="w-5 h-5" />
                    <span className="text-sm font-medium">Download</span>
                  </button>
                )}
                <button
                  onClick={handleCloseModal}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">
              <div className="p-6 pb-16 markdown-body">
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm]}
                  components={{
                    ul: ({node, ...props}) => <ul style={markdownStyles.ul} {...props} />,
                    ol: ({node, ...props}) => <ol style={markdownStyles.ol} {...props} />
                  }}
                >
                  {readmeContent}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
