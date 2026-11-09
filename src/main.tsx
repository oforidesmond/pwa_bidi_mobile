import { AuthProvider } from '@/context/AuthContext';
import { DialogProvider } from '@/context/DialogContext';
import { FeedbackProvider } from '@/context/FeedbackContext';
import { InstallPromptProvider } from '@/context/InstallPromptContext';
import { SetupBannerProvider } from '@/context/SetupBannerContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <DialogProvider>
          <FeedbackProvider>
            <AuthProvider>
              <SetupBannerProvider>
                <InstallPromptProvider>
                  <App />
                </InstallPromptProvider>
              </SetupBannerProvider>
            </AuthProvider>
          </FeedbackProvider>
        </DialogProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
);
