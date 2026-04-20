import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ClientApp from './pages/ClientApp';
import CommerceApp from './pages/CommerceApp';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ClientApp />} />
        <Route path="/admin" element={<CommerceApp />} />
      </Routes>
    </BrowserRouter>
  );
}
