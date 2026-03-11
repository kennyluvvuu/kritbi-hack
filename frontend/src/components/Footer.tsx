import React from 'react';
import { Heart } from 'lucide-react';

export const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-main">
          <div className="footer-info">
            <span className="footer-brand">КАЧИНАТОР</span>
            <span className="footer-divider"></span>
            <span className="footer-desc">Система высокоточного прогнозирования уровня воды</span>
          </div>
          <div className="footer-copyright">
            © {currentYear} Команда <span className="team-name">[LE]SBI</span>. Сделано в рамках хакатона.
          </div>
        </div>
        <div className="footer-bottom">
          <div className="footer-tagline">
            Бережем Качу вместе <Heart size={12} className="heart-icon" />
          </div>
        </div>
      </div>
    </footer>
  );
};
