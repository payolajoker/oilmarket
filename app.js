// ========================================
// 5일장 찾기 - 메인 애플리케이션 (카카오맵 포함)
// ========================================

// 상태 관리
const state = {
    selectedDate: new Date(),
    userLocation: null,
    markets: [],
    filteredMarkets: [],
    map: null,
    markers: [],
    overlays: [],
    selectedMarket: null
};

// DOM 요소 (initApp에서 초기화)
let elements = {};

// ========================================
// 유틸리티 함수
// ========================================

/**
 * Haversine 공식으로 두 좌표 사이의 거리 계산 (km)
 */
function getDistance(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * 거리를 보기 좋은 형식으로 변환
 */
function formatDistance(km) {
    if (km < 1) {
        return `${Math.round(km * 1000)}m`;
    }
    return `${km.toFixed(1)}km`;
}

/**
 * 날짜의 끝자리 가져오기
 */
function getDayEnding(date) {
    return date.getDate() % 10;
}

/**
 * 장날 배열을 보기 좋은 형식으로 변환
 */
function formatMarketDays(days) {
    return days.map(d => d === 0 ? '10일' : `${d}일`).join(', ');
}

/**
 * 시장이 특정 날짜에 열리는지 확인
 */
function isMarketOpen(market, date) {
    const ending = getDayEnding(date);
    return market.days.includes(ending);
}

/**
 * 날짜를 YYYY-MM-DD 형식으로 변환
 */
function formatDateForInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * YYYY-MM-DD 문자열을 Date 객체로 변환
 */
function parseDate(dateString) {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
}

// ========================================
// 카카오맵 초기화
// ========================================

/**
 * 카카오맵 초기화
 */
function initMap() {
    const mapContainer = document.getElementById('map');
    const mapOption = {
        center: new kakao.maps.LatLng(37.5665, 126.9780), // 서울 시청 기본값
        level: 8 // 줌 레벨
    };

    state.map = new kakao.maps.Map(mapContainer, mapOption);

    // 지도 컨트롤 추가
    const zoomControl = new kakao.maps.ZoomControl();
    state.map.addControl(zoomControl, kakao.maps.ControlPosition.RIGHT);
}

/**
 * 지도에 시장 마커 표시
 */
function updateMapMarkers() {
    // 기존 마커 및 오버레이 제거
    state.markers.forEach(marker => marker.setMap(null));
    state.overlays.forEach(overlay => overlay.setMap(null));
    state.markers = [];
    state.overlays = [];

    if (!state.map || state.filteredMarkets.length === 0) return;

    const bounds = new kakao.maps.LatLngBounds();

    state.filteredMarkets.forEach((market, index) => {
        const position = new kakao.maps.LatLng(market.lat, market.lng);

        // 마커 이미지 설정 (상위 3개는 다른 색상)
        const markerColor = index < 3 && market.distance !== null ? '#f59e0b' : '#6366f1';

        // 커스텀 마커 생성
        const markerContent = document.createElement('div');
        markerContent.style.cssText = `
      width: 28px;
      height: 28px;
      background: ${markerColor};
      border: 2px solid white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: bold;
      color: white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      cursor: pointer;
    `;
        markerContent.textContent = index < 10 ? index + 1 : '';

        const customOverlay = new kakao.maps.CustomOverlay({
            position: position,
            content: markerContent,
            yAnchor: 0.5,
            xAnchor: 0.5
        });

        customOverlay.setMap(state.map);
        state.markers.push(customOverlay);

        // 마커 클릭 이벤트
        markerContent.addEventListener('click', () => {
            selectMarket(market, index);
            showMarketInfoOverlay(market, position);
        });

        bounds.extend(position);
    });

    // 사용자 위치 마커 추가
    if (state.userLocation) {
        const userPosition = new kakao.maps.LatLng(state.userLocation.lat, state.userLocation.lng);

        const userMarkerContent = document.createElement('div');
        userMarkerContent.style.cssText = `
      width: 16px;
      height: 16px;
      background: #22c55e;
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 0 10px rgba(34, 197, 94, 0.5);
    `;

        const userOverlay = new kakao.maps.CustomOverlay({
            position: userPosition,
            content: userMarkerContent,
            yAnchor: 0.5,
            xAnchor: 0.5
        });

        userOverlay.setMap(state.map);
        state.markers.push(userOverlay);
        bounds.extend(userPosition);
    }

    // 지도 영역 조정 (축척 설정) - 사용자 위치 + 가장 가까운 시장 포함
    if (state.userLocation && state.filteredMarkets.length > 0) {
        const bounds = new kakao.maps.LatLngBounds();

        // 사용자 위치
        const userPosition = new kakao.maps.LatLng(state.userLocation.lat, state.userLocation.lng);
        bounds.extend(userPosition);

        // 가장 가까운 시장
        const nearestMarket = state.filteredMarkets[0];
        const marketPosition = new kakao.maps.LatLng(nearestMarket.lat, nearestMarket.lng);
        bounds.extend(marketPosition);

        // 여백 설정
        state.map.setBounds(bounds, 80);
    } else if (state.filteredMarkets.length > 0) {
        state.map.setBounds(bounds);
    }
}

/**
 * 시장 정보 오버레이 표시
 */
function showMarketInfoOverlay(market, position) {
    // 기존 정보 오버레이 제거
    state.overlays.forEach(overlay => overlay.setMap(null));
    state.overlays = [];

    const distanceText = market.distance !== null
        ? formatDistance(market.distance)
        : '거리 정보 없음';

    const content = `
    <div style="
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 12px 16px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
      font-family: 'Noto Sans KR', sans-serif;
      min-width: 140px;
      position: relative;
      z-index: 100;
    ">
      <div style="font-size: 14px; font-weight: 600; color: #f8fafc; margin-bottom: 4px;">
        ${market.name}
      </div>
      <div style="font-size: 12px; color: #f59e0b; font-weight: 500;">
        📍 ${distanceText}
      </div>
      <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">
        장날: ${formatMarketDays(market.days)}
      </div>
      <div style="display:flex; gap:6px; margin-top:10px; border-top:1px solid #334155; padding-top:8px;">
        <a href="https://map.kakao.com/link/to/${market.name},${market.lat},${market.lng}" target="_blank" style="flex:1; background:#0ea5e9; color:white; font-size:11px; padding:6px 0; text-align:center; border-radius:4px; text-decoration:none; display:block;">🚗 길찾기</a>
        <a href="https://map.kakao.com/link/search/${market.name}" target="_blank" style="flex:1; background:#64748b; color:white; font-size:11px; padding:6px 0; text-align:center; border-radius:4px; text-decoration:none; display:block;">🔍 상세</a>
      </div>
    </div>
  `;

    const infoOverlay = new kakao.maps.CustomOverlay({
        position: position,
        content: content,
        yAnchor: 1.25,
        xAnchor: 0.5,
        zIndex: 100
    });

    infoOverlay.setMap(state.map);
    state.overlays.push(infoOverlay);
}

/**
 * 지도 중심을 사용자 위치로 이동
 */
function centerToUserLocation() {
    if (state.userLocation) {
        const position = new kakao.maps.LatLng(state.userLocation.lat, state.userLocation.lng);
        state.map.setCenter(position);
        state.map.setLevel(6);
    } else {
        getUserLocation();
    }
}

// ========================================
// 시장 선택
// ========================================

/**
 * 시장 선택
 */
function selectMarket(market, index) {
    state.selectedMarket = market;

    // 카드 하이라이트
    document.querySelectorAll('.market-card').forEach((card, i) => {
        card.classList.toggle('active', i === index);
    });

    // 지도 중심 이동
    if (state.map) {
        const position = new kakao.maps.LatLng(market.lat, market.lng);
        state.map.setCenter(position);
        // showMarketInfoOverlay 호출은 클릭 이벤트에서 처리됨
    }
}

// ========================================
// 시장 필터링 및 정렬
// ========================================

/**
 * 선택된 날짜에 열리는 시장 필터링
 */
function filterMarketsByDate(date) {
    return MARKET_DATA.filter(market => isMarketOpen(market, date));
}

/**
 * 시장을 거리순으로 정렬
 */
function sortMarketsByDistance(markets, userLocation) {
    return markets
        .map(market => ({
            ...market,
            distance: userLocation
                ? getDistance(userLocation.lat, userLocation.lng, market.lat, market.lng)
                : null
        }))
        .sort((a, b) => {
            if (a.distance === null && b.distance === null) return 0;
            if (a.distance === null) return 1;
            if (b.distance === null) return -1;
            return a.distance - b.distance;
        });
}

// ========================================
// UI 렌더링
// ========================================

/**
 * 시장 카드 HTML 생성
 */
function createMarketCard(market, index) {
    const distanceHTML = market.distance !== null
        ? `<span class="market-distance">📍 ${formatDistance(market.distance)}</span>`
        : `<span class="market-distance no-location">위치 정보 없음</span>`;

    const rankBadge = index < 3 && market.distance !== null
        ? `<div class="market-rank">${index + 1}</div>`
        : '';

    // data-name 속성 추가 (디버깅용)
    return `
    <article class="market-card" data-index="${index}" onclick="handleMarketClick(${index})">
      ${rankBadge}
      <div class="market-header">
        <h3 class="market-name">${market.name}</h3>
        ${distanceHTML}
      </div>
      <p class="market-address">📍 ${market.address}</p>
      <div class="market-days">
        <span class="market-days-label">장날:</span>
        <span class="market-days-value">${formatMarketDays(market.days)}</span>
      </div>
      
      <!-- 상세 정보 버튼 (항상 표시 또는 선택 시 표시) -->
      <div class="market-actions" onclick="event.stopPropagation()">
        <a href="https://map.kakao.com/link/to/${market.name},${market.lat},${market.lng}" target="_blank" class="market-action-btn btn-route">
          🚗 길찾기
        </a>
        <a href="https://map.kakao.com/link/search/${market.name}" target="_blank" class="market-action-btn btn-detail">
          🔍 상세정보
        </a>
      </div>
    </article>
  `;
}

/**
 * 시장 카드 클릭 핸들러
 */
function handleMarketClick(index) {
    const market = state.filteredMarkets[index];
    selectMarket(market, index);
    showMarketInfoOverlay(market, new kakao.maps.LatLng(market.lat, market.lng));

    // 모바일에서는 카드가 클릭되면 해당 위치로 스크롤하거나 지도로 포커스 이동 가능
    // 현재는 지도만 이동
}

/**
 * 시장 목록 렌더링
 */
function renderMarketList() {
    const { selectedDate, userLocation } = state;

    // 해당 날짜에 열리는 시장 필터링
    const openMarkets = filterMarketsByDate(selectedDate);

    // 거리순 정렬
    const sortedMarkets = sortMarketsByDistance(openMarkets, userLocation);
    state.filteredMarkets = sortedMarkets;

    // 통계 업데이트 제거 (요청사항 2, 3)
    // elements.marketCount 및 elements.dayEnding 제거됨

    // 목록 렌더링
    if (sortedMarkets.length === 0) {
        elements.marketList.innerHTML = `
      <div class="empty-message">
        <div class="empty-icon">🏪</div>
        <p>이 날은 열리는 5일장이 없습니다.</p>
        <p>다른 날짜를 선택해 보세요.</p>
      </div>
    `;
    } else {
        elements.marketList.innerHTML = sortedMarkets
            .map((market, index) => createMarketCard(market, index))
            .join('');
    }

    // 지도 마커 업데이트
    updateMapMarkers();
}

// ========================================
// 위치 서비스
// ========================================

/**
 * 사용자 위치 가져오기
 */
function getUserLocation() {
    if (!navigator.geolocation) {
        console.error('이 브라우저는 위치 서비스를 지원하지 않습니다.');
        return;
    }

    elements.locationBtn.disabled = true;
    elements.locationBtn.innerHTML = '<span class="btn-icon">⏳</span><span class="btn-text">확인 중</span>';

    // 상태 메시지 UI 제거됨

    navigator.geolocation.getCurrentPosition(
        (position) => {
            state.userLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };

            showLocationSuccess();
            renderMarketList();
        },
        (error) => {
            let message = '위치를 가져올 수 없습니다.';
            switch (error.code) {
                case error.PERMISSION_DENIED:
                    message = '위치 권한이 거부되었습니다.';
                    break;
                case error.POSITION_UNAVAILABLE:
                    message = '위치 정보를 사용할 수 없습니다.';
                    break;
                case error.TIMEOUT:
                    message = '위치 요청 시간이 초과되었습니다.';
                    break;
            }
            showLocationError(message);
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000
        }
    );
}

/**
 * 위치 성공 표시
 */
function showLocationSuccess() {
    elements.locationBtn.disabled = false;
    elements.locationBtn.innerHTML = '<span class="btn-icon">📍</span><span class="btn-text">내 위치</span>';
    // console.log('위치 확인 완료');
}

/**
 * 위치 오류 표시
 */
function showLocationError(message) {
    elements.locationBtn.disabled = false;
    elements.locationBtn.innerHTML = '<span class="btn-icon">📍</span><span class="btn-text">내 위치</span>';
    console.error(message);
    alert('위치를 가져오는데 실패했습니다: ' + message);
}

// ========================================
// 날짜/이벤트 핸들러
// ========================================

/**
 * 날짜 변경 핸들러 (Input)
 */
function handleDateChange(event) {
    state.selectedDate = parseDate(event.target.value);
    renderMarketList();
}

/**
 * 날짜 변경 (버튼)
 */
function changeDate(days) {
    const newDate = new Date(state.selectedDate);
    newDate.setDate(newDate.getDate() + days);
    state.selectedDate = newDate;
    elements.datePicker.value = formatDateForInput(newDate);
    renderMarketList();
}

/**
 * 오늘 날짜로 설정
 */
function setToday() {
    state.selectedDate = new Date();
    elements.datePicker.value = formatDateForInput(state.selectedDate);
    renderMarketList();
}

// ========================================
// 초기화
// ========================================

/**
 * DOM 요소 초기화
 */
function initElements() {
    elements = {
        datePicker: document.getElementById('date-picker'),
        prevDayBtn: document.getElementById('prev-day-btn'), // 추가
        nextDayBtn: document.getElementById('next-day-btn'), // 추가
        todayBtn: document.getElementById('today-btn'), // 추가
        locationBtn: document.getElementById('location-btn'),
        marketList: document.getElementById('market-list'),
        // 제거됨: marketCount, dayEnding, centerLocationBtn(삭제), locationStatus(삭제)
    };
}

/**
 * 앱 초기화
 */
function initApp() {
    // DOM 요소 초기화
    initElements();

    // 카카오맵 초기화
    initMap();

    // 오늘 날짜로 date picker 설정
    elements.datePicker.value = formatDateForInput(state.selectedDate);

    // 이벤트 리스너 등록
    elements.datePicker.addEventListener('change', handleDateChange);
    if (elements.prevDayBtn) elements.prevDayBtn.addEventListener('click', () => changeDate(-1));
    if (elements.nextDayBtn) elements.nextDayBtn.addEventListener('click', () => changeDate(1));
    if (elements.todayBtn) elements.todayBtn.addEventListener('click', setToday);

    if (elements.locationBtn) elements.locationBtn.addEventListener('click', getUserLocation);
    // elements.centerLocationBtn 제거됨 (내 위치 버튼과 기능 통합 또는 불필요)

    // 초기 렌더링
    renderMarketList();
}

// DOM 로드 후 카카오맵 SDK 로드 완료 대기 후 초기화
document.addEventListener('DOMContentLoaded', function () {
    kakao.maps.load(function () {
        initApp();
    });
});
