import { useEffect, useState } from "react";

const REPO_OWNER = "lumapps-marketplace";
const REPO_NAME = "lumapps-extension-code-sample";
const FOLDER_PATH = "micro-app/micro-app/Plug%20and%20play";
const API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FOLDER_PATH}`;
import './iframe.css';

export default function GitHubGallery() {
  const [items, setItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Add the filtered items logic
  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

  return (
    <div className="gallery-container">
      <header className="gallery-header">
        <h1 className="text-2xl font-bold text-center text-white mb-2">
          LumApps Micro-apps gallery
        </h1>
        <input
          type="text"
          placeholder="Search for an extension..."
          className="w-full px-3 py-1.5 rounded-lg bg-white/10 border-white/20 text-white"
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </header>

      <div className="px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => (
            <div key={item.name} className="gallery-card rounded-lg shadow-sm">
              {item.preview ? (
                <div className="relative h-48 overflow-hidden group">
                  <img
                    src={item.preview}
                    alt={item.name}
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : (
                <div className="h-48 bg-gray-100 flex items-center justify-center">
                  <span className="text-gray-400 text-lg">No preview available</span>
                </div>
              )}
              <div className="p-6">
                <h2 className="text-xl font-bold mb-4 text-gray-800">{item.name}</h2>
                <div className="flex gap-4">
                  {item.readme && (
                    <button
                      onClick={() => window.open(item.readme, '_blank')}
                      className="flex-1 bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-2.5 rounded-lg transition-all duration-300 hover:shadow-md font-medium"
                    >
                      README
                    </button>
                  )}
                  {item.jsonFile && (
                    <button
                      onClick={() => window.open(item.jsonFile, '_blank')}
                      className="flex-1 bg-purple-500 hover:bg-purple-600 text-white px-6 py-2.5 rounded-lg transition-all duration-300 hover:shadow-md font-medium"
                    >
                      JSON
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
