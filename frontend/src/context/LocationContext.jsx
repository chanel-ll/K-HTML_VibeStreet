import React, { createContext, useContext, useState } from 'react'

const LocationContext = createContext()

export const useLocation = () => {
  const context = useContext(LocationContext)
  if (!context) {
    throw new Error('useLocation must be used within a LocationProvider')
  }
  return context
}

export const LocationProvider = ({ children }) => {
  const [currentLocation, setCurrentLocation] = useState(null)
  const [currentAddress, setCurrentAddress] = useState('')
  const [locationPermission, setLocationPermission] = useState(null) // 'granted', 'denied', 'prompt'
  const [locationError, setLocationError] = useState(null)
  const [isGettingLocation, setIsGettingLocation] = useState(false)

  // 카카오맵 API를 이용한 GPS 위치 정보 요청
  const requestGPSLocation = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        const error = 'GPS를 지원하지 않는 브라우저입니다.'
        setLocationError(error)
        reject(new Error(error))
        return
      }

      // 카카오맵 SDK 확인
      if (!window.kakao || !window.kakao.maps || !window.kakao.maps.services) {
        const error = '카카오맵 API가 로드되지 않았습니다.'
        setLocationError(error)
        reject(new Error(error))
        return
      }

      setIsGettingLocation(true)
      setLocationError(null)
      setCurrentAddress('위치 정보 확인 중...')

      console.log('[LocationContext] GPS 위치 정보 요청 시작')

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords
          const location = { latitude, longitude }
          setCurrentLocation(location)
          setLocationPermission('granted')
          
          console.log(`[LocationContext] GPS 위치 획득 성공: ${latitude}, ${longitude}`)
          
          // 카카오맵 Geocoder를 사용하여 주소 변환
          try {
            const address = await getAddressFromKakao(latitude, longitude)
            setCurrentAddress(address || '주소를 확인할 수 없습니다.')
            console.log(`[LocationContext] 주소 변환 성공: ${address}`)
          } catch (error) {
            console.error('[LocationContext] 주소 변환 실패:', error)
            setCurrentAddress('주소를 확인할 수 없습니다.')
          }
          
          setIsGettingLocation(false)
          resolve(location)
        },
        (error) => {
          let errorMessage
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = '위치 정보 접근이 거부되었습니다.'
              setLocationPermission('denied')
              break
            case error.POSITION_UNAVAILABLE:
              errorMessage = '위치 정보를 사용할 수 없습니다.'
              break
            case error.TIMEOUT:
              errorMessage = '위치 정보 요청 시간이 초과되었습니다.'
              break
            default:
              errorMessage = '위치 정보를 가져오는데 실패했습니다.'
              break
          }
          console.error('[LocationContext] GPS 에러:', errorMessage)
          setLocationError(errorMessage)
          setCurrentAddress('위치를 확인할 수 없습니다.')
          setIsGettingLocation(false)
          reject(new Error(errorMessage))
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5분간 캐시 사용
        }
      )
    })
  }

  // 카카오맵 Geocoder를 사용한 주소 변환
  const getAddressFromKakao = (latitude, longitude) => {
    return new Promise((resolve, reject) => {
      const { kakao } = window
      
      if (!kakao || !kakao.maps || !kakao.maps.services) {
        reject(new Error('카카오맵 API가 로드되지 않았습니다.'))
        return
      }

      const geocoder = new kakao.maps.services.Geocoder()
      
      geocoder.coord2Address(longitude, latitude, (result, status) => {
        if (status === kakao.maps.services.Status.OK && result.length > 0) {
          console.log('[LocationContext] 카카오맵 API 응답:', result[0]) // 디버깅용
          
          const roadAddr = result[0].road_address
          const jibunAddr = result[0].address
          
          // 동 단위까지 표시 (도로명 주소 우선, 지번 주소 대체)
          let displayAddress
          
          if (roadAddr) {
            // 도로명 주소: "서울시 강남구 역삼동" 형태
            const region1 = roadAddr.region_1depth_name.replace('특별시', '시').replace('광역시', '시')
            const region2 = roadAddr.region_2depth_name
            const region3 = roadAddr.region_3depth_name || roadAddr.building_name || ''
            
            console.log('[LocationContext] 도로명 주소:', { region1, region2, region3 })
            
            if (region3) {
              displayAddress = `${region1} ${region2} ${region3}`
            } else {
              // region_3depth_name이 없으면 지번 주소에서 동 정보 가져오기
              const jibunRegion3 = jibunAddr.region_3depth_name || ''
              displayAddress = jibunRegion3 ? 
                `${region1} ${region2} ${jibunRegion3}` : 
                `${region1} ${region2}`
            }
          } else if (jibunAddr) {
            // 지번 주소: "서울시 강남구 역삼동" 형태
            const region1 = jibunAddr.region_1depth_name.replace('특별시', '시').replace('광역시', '시')
            const region2 = jibunAddr.region_2depth_name
            const region3 = jibunAddr.region_3depth_name || ''
            
            console.log('[LocationContext] 지번 주소:', { region1, region2, region3 })
            
            displayAddress = region3 ? 
              `${region1} ${region2} ${region3}` : 
              `${region1} ${region2}`
          } else {
            displayAddress = '주소 정보 없음'
          }
          
          console.log('[LocationContext] 최종 주소:', displayAddress)
          resolve(displayAddress.trim())
        } else {
          reject(new Error('주소 정보를 찾을 수 없습니다.'))
        }
      })
    })
  }

  const value = {
    currentLocation,
    currentAddress,
    locationPermission,
    locationError,
    isGettingLocation,
    requestGPSLocation,
    setCurrentAddress
  }

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  )
}
