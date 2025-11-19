const COOKIE_NAME = "workCalendar_lastMonth";

function setCookie(name, value, days = 365) {
	const expires = new Date();
	expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
	document.cookie = `${name}=${encodeURIComponent(
		value
	)};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
}

function getCookie(name) {
	const nameEQ = name + "=";
	const ca = document.cookie.split(";");
	for (let i = 0; i < ca.length; i++) {
		let c = ca[i];
		while (c.charAt(0) === " ") c = c.substring(1, c.length);
		if (c.indexOf(nameEQ) === 0)
			return decodeURIComponent(c.substring(nameEQ.length, c.length));
	}
	return null;
}

function saveCurrentMonth() {
	const monthData = {
		year: currentDate.getFullYear(),
		month: currentDate.getMonth(),
	};
	setCookie(COOKIE_NAME, JSON.stringify(monthData));
}

function getSavedMonth() {
	try {
		const cookieData = getCookie(COOKIE_NAME);
		if (cookieData) {
			const monthData = JSON.parse(cookieData);
			if (
				monthData &&
				typeof monthData.year === "number" &&
				typeof monthData.month === "number"
			) {
				return monthData;
			}
		}
	} catch (error) {
		console.warn("Ошибка при чтении куки:", error);
	}
	return null;
}
