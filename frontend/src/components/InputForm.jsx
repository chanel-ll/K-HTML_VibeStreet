import React from 'react'

export default function InputForm({ value, onChange, onSubmit, loading }) {
  return (
    <div className="card section fade-in">
      <div className="kicker">오늘의 이야기를 들려주세요</div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={6}
        placeholder="오늘의 기분이나 일상을 자유롭게 적어주세요."
        className="textarea"
      />
      <div className="helper">
        <span>감정 분석 후 공감 메시지와 음악 3곡, 산책로를 추천해 드려요.</span>
        <div className="btn-row">
          <button onClick={onSubmit} disabled={loading} className="btn btn-primary">
            {loading ? '분석 중…' : '추천받기'}
          </button>
        </div>
      </div>
    </div>
  )
}
