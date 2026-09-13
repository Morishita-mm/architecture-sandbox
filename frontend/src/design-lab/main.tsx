import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DesignLab } from './DesignLab';
import './design-lab.css';

createRoot(document.getElementById('root')!).render(<StrictMode><DesignLab /></StrictMode>);
