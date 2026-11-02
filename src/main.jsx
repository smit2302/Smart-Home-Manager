import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { HomeProvider } from './context/HomeContext.jsx';
import './styles/app.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <HomeProvider>
        <App />
      </HomeProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
