import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Lab } from './pages/Lab';
import './styles/global.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Lab />
  </StrictMode>,
);
