import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App.jsx';
import { BranchProvider } from './context/BranchContext.jsx';
import { getAuthSession } from './data/auth.js';
import { hydrateCloudState, installCloudRefresh, installCloudSync } from './data/cloudStore.js';
import './styles.css';

async function bootstrap() {
  if (getAuthSession()) await hydrateCloudState().catch(() => {});
  installCloudSync();
  installCloudRefresh();
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <BrowserRouter>
        <BranchProvider>
          <App />
        </BranchProvider>
      </BrowserRouter>
    </React.StrictMode>,
  );
}

bootstrap();
