import { useEffect, useState } from "react";
import { InformationCircleIcon, ArrowDownTrayIcon, XMarkIcon } from '@heroicons/react/24/outline';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import 'github-markdown-css/github-markdown.css';

const REPO_OWNER = "lumapps-marketplace";
const REPO_NAME = "lumapps-extension-code-sample";
const FOLDER_PATH = "micro-app/micro-app/Plug%20and%20play";
const API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FOLDER_PATH}`;
import './iframe.css';

export default function GitHubGallery() {
  const [items, setItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReadme, setSelectedReadme] = useState(null);
  const [readmeContent, setReadmeContent] = useState('');

  const handleTagClick = (tag) => {
    setSearchTerm(searchTerm === tag ? '' : tag);
  };

  const extractTitleAndTags = (name) => {
    // Trouve tous les textes entre crochets dans le nom
    const tagMatches = name.match(/\[(.*?)\]/g) || [];
    // Extrait le titre en retirant tous les textes entre crochets
    const title = name.replace(/\[.*?\]/g, '').trim();
    // Transforme les matches en tags en retirant les crochets
    const tags = tagMatches.map(tag => tag.slice(1, -1).trim());
    
    return { title, tags };
  };

  const filteredItems = items.filter(item => {
    const { title, tags } = extractTitleAndTags(item.name);
    const searchLower = searchTerm.toLowerCase();
    return title.toLowerCase().includes(searchLower) || 
           tags.some(tag => tag.toLowerCase().includes(searchLower));
  });

  useEffect(() => {
    const fetchData = async () => {
      const headers = {
        Authorization: `token ${process.env.REACT_APP_GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
      };

      fetch(API_URL, { headers })
        .then((res) => {
          if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
          }
          return res.json();
        })
        .then((data) => {
          if (!Array.isArray(data)) {
            console.error('Received data:', data);
            throw new Error('API did not return an array');
          }
          
          const folders = data.filter((item) => item.type === "dir");
          
          const fetchDetails = folders.map((folder) => {
            const encodedFolderName = encodeURIComponent(folder.name);
            const folderUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FOLDER_PATH}/${encodedFolderName}`;
            return fetch(folderUrl, { headers })  // Add headers here too
              .then((res) => {
                if (!res.ok) {
                  throw new Error(`HTTP error! status: ${res.status}`);
                }
                return res.json();
              })
              .then((files) => {
                const preview = files.find((file) => file.name.endsWith(".png"));
                const readme = files.find((file) => file.name.toLowerCase() === "readme.md");
                const jsonFile = files.find((file) => file.name.endsWith(".json"));
                
                return {
                  name: folder.name,
                  preview: preview ? preview.download_url : null,
                  readme: readme ? readme.html_url.replace(/\[/g, '%5B').replace(/\]/g, '%5D') : null,
                  jsonFile: jsonFile ? jsonFile.download_url.replace(/\[/g, '%5B').replace(/\]/g, '%5D') : null,
                };
              });
          });
          
          Promise.all(fetchDetails).then(setItems);
        })
        .catch((error) => {
          console.error('Error fetching data:', error);
          setItems([]); // Set empty array in case of error
        });
    };
    fetchData();
  }, []);

  const handleReadmeClick = async (readmeUrl, folderPath) => {
    try {
      const rawUrl = readmeUrl.replace('github.com', 'raw.githubusercontent.com').replace('/blob', '');
      const response = await fetch(rawUrl);
      let content = await response.text();
      
      // Remplacer les balises img avec les URLs des images du même dossier
      content = content.replace(
        /<img\s+src="([^"]+)"\s+[^>]*>/g,
        (match, imageName) => {
          const decodedName = decodeURIComponent(imageName);
          return `![${decodedName}](${folderPath}/${decodedName})`;
        }
      );
      
      setReadmeContent(content);
      setSelectedReadme(readmeUrl);
    } catch (error) {
      console.error('Error fetching readme:', error);
    }
  };

  // Modifier l'appel dans le bouton
  <button
    onClick={() => handleReadmeClick(item.readme, item.preview?.substring(0, item.preview.lastIndexOf('/')))}
    className="bg-white hover:bg-gray-100 p-2 rounded-lg transition-all duration-300 hover:shadow-md flex items-center justify-center"
    title="View Documentation"
  >
    <InformationCircleIcon className="w-5 h-5 text-[#245be7]" />
  </button>

  // Modifier le style de la modale
  {selectedReadme && (
    <div className="fixed inset-0 bg-gray-900/75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg w-full max-w-4xl h-[90vh] flex flex-col shadow-xl">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center flex-shrink-0">
          <h2 className="text-xl font-bold text-gray-800">Documentation</h2>
          <button
            onClick={() => {
              setSelectedReadme(null);
              setReadmeContent('');
            }}
            className="text-gray-500 hover:text-gray-700"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 pb-12 markdown-body">
            <ReactMarkdown>{readmeContent}</ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  )}

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

  return (
    <div className="gallery-container min-h-screen bg-[#faf9f7]">
      <header className="bg-gradient-to-r from-[#2493ff] to-[#245be7] text-white py-12 px-6 mb-12 shadow-lg">
        <h1 className="text-2xl font-bold text-center text-white mb-4">
          LumApps Micro-apps gallery
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
      </header>

      <div className="px-4 pb-12">
        <div className="columns-1 md:columns-2 lg:columns-4 gap-6 space-y-6">
          {filteredItems.map((item) => {
            const { title, tags } = extractTitleAndTags(item.name);
            return (
              <div key={item.name} className="bg-white rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 relative group break-inside-avoid">
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
                      <div className="absolute top-0 right-0 bottom-0 w-12 flex flex-col justify-center gap-3 p-2">
                        {item.readme && (
                          <button
                            onClick={() => handleReadmeClick(item.readme)}
                            className="bg-white hover:bg-gray-100 p-2 rounded-lg transition-all duration-300 hover:shadow-md flex items-center justify-center"
                            title="View Documentation"
                          >
                            <InformationCircleIcon className="w-5 h-5 text-[#245be7]" />
                          </button>
                        )}
                        {item.jsonFile && (
                          <button
                            onClick={() => handleDownload(item.jsonFile, item.name)}
                            className="bg-white hover:bg-gray-100 p-2 rounded-lg transition-all duration-300 hover:shadow-md flex items-center justify-center"
                            title="Download Configuration"
                          >
                            <ArrowDownTrayIcon className="w-5 h-5 text-[#245be7]" />
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
                  <h2 className="text-lg font-bold mb-2 text-gray-800">{title}</h2>
                  <div className="flex flex-wrap gap-1">
                    {tags.map((tag, index) => (
                      <button 
                        key={index}
                        onClick={() => handleTagClick(tag)}
                        className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors duration-200 
                          ${searchTerm === tag 
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
        <div className="fixed inset-0 bg-gray-900/75 flex items-center justify-center p-4 z-50 overflow-hidden">
          <div className="bg-white rounded-lg w-full max-w-4xl h-[90vh] flex flex-col shadow-xl">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800">Documentation</h2>
              <button
                onClick={() => {
                  setSelectedReadme(null);
                  setReadmeContent('');
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">
              <div className="p-6 pb-16 markdown-body">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{readmeContent}</ReactMarkdown>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
