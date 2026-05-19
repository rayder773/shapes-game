const PHONE_MAX_VIEWPORT_PX = 820;
const MOBILE_USER_AGENT_PATTERN = /Android.+Mobile|iPhone|iPod|Windows Phone|webOS|BlackBerry|IEMobile|Opera Mini/i;

export function isTouchDevice(): boolean {
  return window.matchMedia("(pointer: coarse)").matches || window.matchMedia("(hover: none)").matches;
}

function hasMobileUserAgent(): boolean {
  const navigatorWithUserAgentData = navigator as Navigator & {
    userAgentData?: {
      mobile?: boolean;
    };
  };

  if (navigatorWithUserAgentData.userAgentData?.mobile === true) {
    return true;
  }

  return MOBILE_USER_AGENT_PATTERN.test(navigator.userAgent);
}

export function isPhoneDevice(): boolean {
  const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
  const shortestSide = Math.min(viewportWidth, viewportHeight);

  return hasMobileUserAgent() && isTouchDevice() && shortestSide < PHONE_MAX_VIEWPORT_PX;
}
