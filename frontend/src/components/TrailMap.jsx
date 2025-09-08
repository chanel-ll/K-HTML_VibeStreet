import React, { useEffect, useRef, useState } from 'react'
import { useLocation } from '../context/LocationContext'
import './TrailMap.css'

const TrailMap = ({ trails, isVisible, onClose }) => {
  const mapRef = useRef(null)
  const [map, setMap] = useState(null)
  const [markers, setMarkers] = useState([])
  const [polylines, setPolylines] = useState([])
  const { currentLocation } = useLocation()

  useEffect(() => {
    if (!isVisible || !window.kakao || !window.kakao.maps) {
      return
    }

    // 지도 초기화
    const initializeMap = () => {
      const container = mapRef.current
      
      // 기본 중심 좌표 (서울시청)
      let centerLat = 37.5665
      let centerLng = 126.9780
      
      // 사용자 현재 위치가 있으면 해당 위치를 중심으로
      if (currentLocation) {
        centerLat = currentLocation.latitude
        centerLng = currentLocation.longitude
      }

      const options = {
        center: new window.kakao.maps.LatLng(centerLat, centerLng),
        level: 5 // 지도 확대 레벨
      }

      const kakaoMap = new window.kakao.maps.Map(container, options)
      setMap(kakaoMap)

      // 현재 위치 마커 (사용자 위치)
      if (currentLocation) {
        const userMarkerImage = new window.kakao.maps.MarkerImage(
          'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/marker_red.png',
          new window.kakao.maps.Size(24, 35)
        )
        
        const userMarker = new window.kakao.maps.Marker({
          position: new window.kakao.maps.LatLng(currentLocation.latitude, currentLocation.longitude),
          image: userMarkerImage,
          title: '내 위치'
        })
        
        userMarker.setMap(kakaoMap)
      }
    }

    initializeMap()
  }, [isVisible, currentLocation])

  useEffect(() => {
    if (!map || !trails || trails.length === 0) {
      return
    }

    // 기존 마커들과 폴리라인들 제거
    markers.forEach(marker => marker.setMap(null))
    polylines.forEach(polyline => polyline.setMap(null))

    const newMarkers = []
    const newPolylines = []
    const bounds = new window.kakao.maps.LatLngBounds()

    trails.forEach((trail, index) => {
      console.log(`[TrailMap] Processing trail: ${trail.name}`, trail)

      // 1. 루트 라인 표시 (우선순위)
      if (trail.route && trail.route.coordinates && trail.route.coordinates.length >= 2) {
        console.log(`[TrailMap] ${trail.name}에 루트 데이터 있음: ${trail.route.coordinates.length}개 좌표`)
        
        // 루트 좌표들을 카카오맵 좌표로 변환 (안전하게 처리)
        const routePath = []
        
        try {
          for (let i = 0; i < trail.route.coordinates.length; i++) {
            const coord = trail.route.coordinates[i]
            if (coord && coord.length >= 2) {
              const lng = parseFloat(coord[0])
              const lat = parseFloat(coord[1])
              
              // 유효한 좌표인지 확인
              if (!isNaN(lng) && !isNaN(lat) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                const position = new window.kakao.maps.LatLng(lat, lng)
                routePath.push(position)
                bounds.extend(position)
              } else {
                console.warn(`[TrailMap] 잘못된 좌표 건너뜀: [${lng}, ${lat}]`)
              }
            }
          }

          // 최소 2개 이상의 유효한 좌표가 있을 때만 폴리라인 생성
          if (routePath.length >= 2) {
            // 배경 선 (더 굵은 어두운 선)
            const backgroundLine = new window.kakao.maps.Polyline({
              path: routePath,
              strokeWeight: 8,
              strokeColor: '#333333', // 어두운 배경선
              strokeOpacity: 0.6,
              strokeStyle: 'solid'
            })

            // 메인 루트 선 (더 눈에 띄는 색상)
            const polyline = new window.kakao.maps.Polyline({
              path: routePath,
              strokeWeight: 6,
              strokeColor: '#FF4444', // 더 진한 빨간색
              strokeOpacity: 0.9,
              strokeStyle: 'solid'
            })

            // 안전하게 지도에 추가 (배경선 먼저, 메인선 나중에)
            try {
              backgroundLine.setMap(map)
              polyline.setMap(map)
              newPolylines.push(backgroundLine)
              newPolylines.push(polyline)
              console.log(`[TrailMap] ${trail.name} 이중 폴리라인 생성 성공: ${routePath.length}개 좌표`)
            } catch (polylineError) {
              console.error(`[TrailMap] ${trail.name} 폴리라인 생성 실패:`, polylineError)
            }
          } else {
            console.warn(`[TrailMap] ${trail.name}: 유효한 좌표가 부족함 (${routePath.length}개)`)
          }
        } catch (routeError) {
          console.error(`[TrailMap] ${trail.name} 루트 처리 중 오류:`, routeError)
        }

        // 시작점과 끝점 마커 표시 (안전하게 처리)
        if (routePath.length > 0) {
          try {
            // 시작점 마커 (초록색)
            const startPosition = routePath[0]
            const startMarkerImage = new window.kakao.maps.MarkerImage(
              'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/marker_green.png',
              new window.kakao.maps.Size(24, 35)
            )
            
            const startMarker = new window.kakao.maps.Marker({
              position: startPosition,
              image: startMarkerImage,
              title: `${trail.name} 시작점`,
              clickable: true
            })

            startMarker.setMap(map)

            // 끝점 마커 (빨간색) - 루트가 2개 이상의 점으로 구성된 경우
            if (routePath.length > 1) {
              const endPosition = routePath[routePath.length - 1]
              const endMarkerImage = new window.kakao.maps.MarkerImage(
                'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/marker_red.png',
                new window.kakao.maps.Size(24, 35)
              )
              
              const endMarker = new window.kakao.maps.Marker({
                position: endPosition,
                image: endMarkerImage,
                title: `${trail.name} 끝점`,
                clickable: true
              })

              endMarker.setMap(map)
              newMarkers.push(endMarker)
            }

            // 시작점 정보창
            const infoWindow = new window.kakao.maps.InfoWindow({
              content: `
                <div style="padding: 10px; min-width: 200px;">
                  <div style="font-weight: bold; margin-bottom: 5px; color: #333;">
                    🚶‍♂️ ${trail.name}
                  </div>
                  <div style="font-size: 12px; color: #666; margin-bottom: 5px;">
                    📍 ${trail.address}
                  </div>
                  <div style="font-size: 12px; color: #FF4444; font-weight: bold;">
                    🗺️ 루트 길이: ${routePath.length}개 지점
                  </div>
                  <div style="font-size: 11px; color: #28a745; margin-top: 3px;">
                    🟢 시작점 | 🔴 끝점
                  </div>
                  <div style="font-size: 12px; color: #4285f4; font-weight: bold;">
                    ⭐ 추천 점수: ${trail.score}
                  </div>
                </div>
              `
            })

            // 시작점 마커 클릭 이벤트
            window.kakao.maps.event.addListener(startMarker, 'click', () => {
              // 다른 정보창들 닫기
              newMarkers.forEach(m => m.infoWindow?.close())
              
              // 현재 정보창 열기
              infoWindow.open(map, startMarker)
              startMarker.infoWindow = infoWindow
            })

            newMarkers.push(startMarker)
            console.log(`[TrailMap] ${trail.name} 시작점 마커 생성 성공`)
          } catch (markerError) {
            console.error(`[TrailMap] ${trail.name} 시작점 마커 생성 실패:`, markerError)
          }
        }

      } else if (trail.coordinates) {
        // 2. 루트 데이터가 없으면 기본 마커만 표시
        console.log(`[TrailMap] ${trail.name}에 루트 없음, 기본 마커만 표시`)
        
        const { latitude, longitude } = trail.coordinates
        const position = new window.kakao.maps.LatLng(latitude, longitude)

        // 기본 마커 생성
        const marker = new window.kakao.maps.Marker({
          position: position,
          title: trail.name,
          clickable: true
        })

        marker.setMap(map)

        // 기본 정보창
        const infoWindow = new window.kakao.maps.InfoWindow({
          content: `
            <div style="padding: 10px; min-width: 200px;">
              <div style="font-weight: bold; margin-bottom: 5px; color: #333;">
                🚶‍♂️ ${trail.name}
              </div>
              <div style="font-size: 12px; color: #666; margin-bottom: 5px;">
                📍 ${trail.address}
              </div>
              <div style="font-size: 12px; color: #999;">
                📍 위치만 표시 (루트 정보 없음)
              </div>
              <div style="font-size: 12px; color: #4285f4; font-weight: bold;">
                ⭐ 추천 점수: ${trail.score}
              </div>
            </div>
          `
        })

        // 마커 클릭 이벤트
        window.kakao.maps.event.addListener(marker, 'click', () => {
          // 다른 정보창들 닫기
          newMarkers.forEach(m => m.infoWindow?.close())
          
          // 현재 정보창 열기
          infoWindow.open(map, marker)
          marker.infoWindow = infoWindow
        })

        newMarkers.push(marker)
        bounds.extend(position)

      } else {
        console.warn(`[TrailMap] ${trail.name}에 좌표 정보가 없습니다.`)
      }
    })

    // 사용자 위치도 bounds에 포함
    if (currentLocation) {
      bounds.extend(new window.kakao.maps.LatLng(currentLocation.latitude, currentLocation.longitude))
    }

    // 지도 범위 조정
    if (trails.length === 1 && trails[0].route && trails[0].route.coordinates.length >= 2) {
      // 단일 산책로이고 루트가 있는 경우: 루트 전체가 보이도록 조정
      map.setBounds(bounds)
    } else if (trails.length === 1 && trails[0].coordinates) {
      // 단일 산책로이고 루트가 없는 경우: 해당 위치 중심으로
      const trail = trails[0]
      map.setCenter(new window.kakao.maps.LatLng(trail.coordinates.latitude, trail.coordinates.longitude))
      map.setLevel(3)
    } else if (trails.length > 1) {
      // 여러 산책로인 경우: 모든 요소가 보이도록 범위 조정
      map.setBounds(bounds)
    }

    setMarkers(newMarkers)
    setPolylines(newPolylines)
  }, [map, trails])

  if (!isVisible) {
    return null
  }

  return (
    <div className="trail-map-overlay">
      <div className="trail-map-container">
        <div className="trail-map-header">
          <h3>
            🗺️ {trails.length === 1 ? `${trails[0].name} 위치` : '추천 산책로 지도'}
          </h3>
          <button className="trail-map-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div 
          ref={mapRef} 
          className="trail-map"
          style={{ width: '100%', height: '500px' }}
        />
        <div className="trail-map-legend">
          <div className="legend-item">
            <span className="legend-marker user">📍</span>
            <span>내 위치</span>
          </div>
          <div className="legend-item">
            <span style={{ color: '#28a745', fontSize: '16px' }}>🟢</span>
            <span>시작점</span>
          </div>
          <div className="legend-item">
            <span style={{ color: '#dc3545', fontSize: '16px' }}>🔴</span>
            <span>끝점</span>
          </div>
          <div className="legend-item">
            <span style={{ color: '#FF4444', fontWeight: 'bold' }}>━━━</span>
            <span>산책로 루트</span>
          </div>
          <div className="legend-note">
            마커를 클릭하면 상세 정보를 확인할 수 있습니다
          </div>
        </div>
      </div>
    </div>
  )
}

export default TrailMap
