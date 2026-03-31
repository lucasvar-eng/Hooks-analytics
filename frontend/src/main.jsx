import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { store } from './store/store';
import App from './App';
import './index.css';
import { applyAppearance, getSavedAppearance } from './utils/appearance';

// Theme: default to dark
const savedTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.classList.toggle('dark', savedTheme === 'dark');

try {
  applyAppearance(getSavedAppearance());
} catch {
  applyAppearance(getSavedAppearance());
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </Provider>
  </React.StrictMode>
);
