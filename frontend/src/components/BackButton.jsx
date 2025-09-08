import React from 'react';
import { useNavigate } from 'react-router-dom';

const BackButton = ({ label = '이전 페이지', className = '' }) => {
  const navigate = useNavigate();
  return (
    <button
      className={`btn btn-primary ${className}`}
      onClick={() => navigate(-1)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 14px',
        borderRadius: 10,
      }}
    >
      ← {label}
    </button>
  );
};

export default BackButton;
