const DEFAULT_WORK_HOURS_PER_DAY = 7.8;

const MONTHS = [
	"Январь",
	"Февраль",
	"Март",
	"Апрель",
	"Май",
	"Июнь",
	"Июль",
	"Август",
	"Сентябрь",
	"Октябрь",
	"Ноябрь",
	"Декабрь",
];

const DAYS = [
	"Воскресенье",
	"Понедельник",
	"Вторник",
	"Среда",
	"Четверг",
	"Пятница",
	"Суббота",
];

const TYPES_DAY = {
	work: "Рабочий",
	sick: "Больничный",
	vacation: "Отпуск",
};

// элементы
let EL_CALENDAR,
	EL_CURRENT_MONTH,
	EL_AUTOFILL_MODAL,
	EL_REFRESH_BUTTON,
	EL_CALENDAR_LOADING,
	EL_CONTEXT_MENU,
	EL_ERROR_HANDLER,
	EL_HOURS_MODAL;

let PRODUCTION_CALENDAR;
let MONTH_DATA;
let hash_holidays = {};
let hash_saved_days = {};
let currentDate = new Date();

let context_menu_current_element = null;
let work_hours_per_day = DEFAULT_WORK_HOURS_PER_DAY;
let last_month_cookie;

// Инициализация приложения
document.addEventListener("DOMContentLoaded", init);

async function init() {
	await initDB();
	initElements();

	last_month_cookie = getSavedMonth();
	if (last_month_cookie) {
		currentDate = new Date(last_month_cookie.year, last_month_cookie.month);
	}

	await loadCalendar(currentDate.getFullYear());
	setupEventListeners();
	await rerender();
}

function initElements() {
	EL_CALENDAR = document.getElementById("calendar-body");
	EL_CURRENT_MONTH = document.getElementById("current-month");
	EL_AUTOFILL_MODAL = document.getElementById("auto-fill-modal");
	EL_REFRESH_BUTTON = document.getElementById("refresh-calendar");
	EL_CALENDAR_LOADING = document.getElementById("calendar-loading");
	EL_HOURS_MODAL = document.getElementById("edit-hours-modal");
	EL_CONTEXT_MENU = document.getElementById("menu-context");
	EL_ERROR_HANDLER = document.getElementById("error-handle");
}

// ok Функция для показа модального окна редактирования часов
function showEditHoursModal() {
	if (!context_menu_current_element) return;

	const date_el = new Date(context_menu_current_element.dataset.date);
	const date_display = EL_HOURS_MODAL.querySelector("#edit-hours-date");
	const hours_input = EL_HOURS_MODAL.querySelector("#edit-hours-value");

	// Устанавливаем дату
	const date_formatted = formatDate(date_el);

	date_display.textContent = `${date_el.getDate()} ${
		MONTHS[date_el.getMonth()]
	} ${date_el.getFullYear()} (${DAYS[date_el.getDay()]})`;

	const saved_day = hash_saved_days[date_formatted];
	hours_input.value = floatToTime(saved_day.workingHours);

	toggleleVisableElement(EL_HOURS_MODAL);
}

// ok Функция для сохранения измененных часов
async function saveEditedHours() {
	if (!context_menu_current_element) return;

	const date_el = new Date(context_menu_current_element.dataset.date);
	const hours_input = document.getElementById("edit-hours-value");
	const hours_value = timeToFloat(hours_input.value);

	if (isNaN(hours_value)) {
		alert("Поле времени не должно быть пустым!");
	}

	const date_formatted = formatDate(date_el);
	const saved_day = hash_saved_days[date_formatted];

	saved_day.workingHours = hours_value;
	await saveDays([saved_day]);
	toggleleVisableElement(EL_HOURS_MODAL);
	rerender();
}

// ok Улучшенная настройка обработчиков событий
function setupEventListeners() {
	// Навигация по месяцам
	document
		.getElementById("prev-month")
		.addEventListener("click", () => changeMonth(-1));
	document
		.getElementById("next-month")
		.addEventListener("click", () => changeMonth(1));
	document
		.getElementById("today")
		.addEventListener("click", () => goToToday());

	// Действия
	document
		.getElementById("auto-fill")
		.addEventListener("click", showAutoFillModal);
	document
		.getElementById("clear-month")
		.addEventListener("click", clearCurrentMonth);
	document
		.getElementById("export-data")
		.addEventListener("click", exportData);
	document
		.getElementById("import-data")
		.addEventListener("click", importData);
	document
		.getElementById("refresh-calendar")
		.addEventListener("click", refreshCalendar);
	document
		.querySelectorAll(".clear-time")
		.forEach((el) => el.addEventListener("click", clearTimeField));

	EL_CONTEXT_MENU.querySelectorAll("input").forEach((el) =>
		el.addEventListener("click", () =>
			handleContextMenuAction(el.dataset.action)
		)
	);

	// Модальное окно автозаполнения
	document
		.getElementById("confirm-auto-fill")
		.addEventListener("click", confirmAutoFill);
	document
		.getElementById("cancel-auto-fill")
		.addEventListener("click", () =>
			toggleleVisableElement(EL_AUTOFILL_MODAL)
		);

	// Новые обработчики для модального окна редактирования часов
	document
		.getElementById("confirm-edit-hours")
		.addEventListener("click", saveEditedHours);
	document
		.getElementById("cancel-edit-hours")
		.addEventListener("click", () =>
			toggleleVisableElement(EL_HOURS_MODAL)
		);

	hideShowDataset(true);
	hideShowDataset(false);

	// Закрытие модальных окон при клике вне их
	document
		.querySelectorAll(".modal > .shadow")
		.forEach((el) => el.addEventListener("click", hideModal));

	window.addEventListener("click", (e) => {
		if (
			!EL_CONTEXT_MENU.contains(e.target) &&
			!(e.target === EL_CONTEXT_MENU) &&
			!EL_CONTEXT_MENU.classList.contains("hide-element")
		) {
			toggleleVisableElement(EL_CONTEXT_MENU);
		}
	});

	window.addEventListener("beforeunload", function (e) {
		saveCurrentMonth();
		return true;
	});
}

// todo
function errorHandle(text, subtext) {
	EL_ERROR_HANDLER;
}

// ok
function createElement(type, params, element = "div") {
	const el = document.createElement(element);
	const date_formatted = params?.date ? formatDate(params.date) : null;
	const saved_day = hash_saved_days[date_formatted];

	switch (type) {
		case "EMPTY_DAY":
			el.className = "day empty";
			break;
		case "FILL_DAY":
			el.className = "day";
			el.setAttribute("data-date", date_formatted);

			saved_day?.types?.forEach((item) => {
				el.classList.add(item);
			});

			const today = new Date();
			const todayFormatted = formatDate(today);
			if (date_formatted === todayFormatted) el.classList.add("today");

			const holiday_info = getHolidayInfo(params.date);
			if (!!holiday_info) {
				el.classList.add("holiday");
				el.title = holiday_info;
			} else if (isWeekend(params.date)) {
				el.classList.add("weekend");
			} else {
				el.classList.add("official-workday");
			}

			const header = createElement("DAY_HEADER", params);
			el.appendChild(header);

			const indicator = createElement("TYPE_INDICATOR", params);
			el.appendChild(indicator);
			break;
		case "DAY_HEADER":
			el.className = "day-header";

			const el2 = createElement("DAY_HEADER_NUBMER", params);

			el.appendChild(el2);
			if (saved_day?.workingHours) {
				const el3 = createElement("DAY_HEADER_WORK_TIME", params);
				el.appendChild(el3);
			}
			break;
		case "DAY_HEADER_NUBMER":
			el.className = "day-number";
			el.textContent = params.date.getDate();
			break;
		case "DAY_HEADER_WORK_TIME":
			el.textContent = floatToTime(saved_day?.workingHours);
			el.className = "day-hours";
			el.title = "Часы работы (клик для редактирования)";
			break;
		case "TYPE_INDICATOR":
			el.className = "day-type-indicator";
			saved_day?.types?.forEach((item) => {
				const tag = createElement("TYPE_INDICATOR_TAG", { item: item });
				el.appendChild(tag);
			});
			break;
		case "TYPE_INDICATOR_TAG":
			el.setAttribute("data-indicator", params.item);
			break;
		case "TYPE_TAG":
			el.className = `day-type-tag ${params.type}`;
			el.textContent = TYPES_DAY[params.type] || params.type;
			break;
		case "LOAD_FILE":
			el.type = "file";
			el.accept = ".json";
			el.multiple = false;
			el.style.display = "none";
			break;
		case "_":
			break;
		case "_":
			break;
	}
	return el;
}

// ok Универсальная функция для получения данных месяца
function setMonthData(year, month) {
	if (PRODUCTION_CALENDAR?.year !== currentDate.getFullYear()) {
		return null;
	}
	MONTH_DATA =
		PRODUCTION_CALENDAR.months.find(
			(m) => m.id === currentDate.getMonth()
		) || null;
}

// ok Форматирование даты в ISO
function formatDate(date) {
	const year = date.getFullYear();
	const month = (date.getMonth() + 1).toString().padStart(2, "0");
	const day = date.getDate().toString().padStart(2, "0");
	return `${year}-${month}-${day}`;
}

// ok Функция для показа модального окна автозаполнения
function showAutoFillModal() {
	toggleleVisableElement(EL_AUTOFILL_MODAL);
	EL_AUTOFILL_MODAL.querySelector("#work-hours-per-day").value =
		work_hours_per_day;
}

// ok Функция для выполнения автозаполнения с настройками
async function performAutoFill() {
	const select_type = EL_AUTOFILL_MODAL.querySelector("#schema-type").value;
	const checkbox_values = EL_AUTOFILL_MODAL.querySelectorAll(
		'#custom-days input[type="checkbox"]:checked'
	);
	const select_start_day =
		EL_AUTOFILL_MODAL.querySelector("#start-day-type").value;
	const on_holidays = Number(
		EL_AUTOFILL_MODAL.querySelector("#holiday-work-confirm").checked
	);
	const on_auto_calc = Number(
		EL_AUTOFILL_MODAL.querySelector("#auto-calc-confirm").checked
	);

	let select_hours;
	if (on_auto_calc) {
		select_hours = parseFloat(
			EL_AUTOFILL_MODAL.querySelector("#work-hours-per-day").value
		);
	} else {
		select_hours = timeToFloat(
			EL_AUTOFILL_MODAL.querySelector("#work-time-per-day").value
		);
	}

	const year = currentDate.getFullYear();
	const month = currentDate.getMonth();
	const last_day = new Date(year, month + 1, 0).getDate();

	let start_day;
	let step;
	let count_work_days = 0;
	let select_days;

	let periods = [];
	let holiday_array = [
		0,
		...Object.keys(
			!on_holidays ? PRODUCTION_CALENDAR.holidays?.[month] || {} : {}
		).map((el) => Number(el)),
		last_day + 1,
	];
	holiday_array.sort((a, b) => a - b);
	for (let i = 1; i < holiday_array.length; i++) {
		const start = holiday_array[i - 1] + 1;
		const end = holiday_array[i] - 1;

		if (start <= end) {
			const segment = Array.from(
				{ length: end - start + 1 },
				(_, index) => start + index
			);
			periods.push(segment);
		}
	}
	if (select_start_day === "even" && periods[0][0] == 1) {
		periods[0] = periods[0].slice(1);
	}

	if (select_type == "custom") {
		start_day = 1;
		step = 0;

		let init_day = new Date(year, month, 1).getDay();
		select_days = new Set();
		for (let el_checkbox of checkbox_values) {
			const selectedDay = Number(el_checkbox.value);
			select_days.add(selectedDay);

			const firstOccurrence = ((selectedDay - init_day + 7) % 7) + 1;
			const occurrences =
				Math.floor((last_day - firstOccurrence) / 7) + 1;

			count_work_days += occurrences;
		}
		if (!on_holidays) {
			count_work_days -= Object.keys(
				PRODUCTION_CALENDAR.holidays?.[month] || {}
			)
				.map((day) => new Date(year, month, day).getDay())
				.filter((day) => select_days.has(day)).length;
		}
	} else {
		step = Number(select_type);

		for (const segment of periods) {
			const period_length = segment.length;

			const full_cycles = Math.floor(period_length / (step * 2));
			const remaining_days = (period_length % step) * 2;
			count_work_days +=
				full_cycles * step + Math.min(remaining_days, step);
		}
	}
	let current_step = 0;
	let output = [];
	let calc_hours = on_auto_calc
		? (MONTH_DATA.workingDays * select_hours - MONTH_DATA.shortDays) /
		  count_work_days
		: select_hours;

	for (const period of periods) {
		for (const day of period) {
			const date = new Date(year, month, day);
			const date_formatted = formatDate(date);

			if (select_type === "custom" && !select_days.has(date.getDay())) {
				continue;
			}

			if (select_type !== "custom") {
				if (current_step >= step) {
					current_step++;
					if (current_step >= step * 2) current_step = 0;
					continue;
				}
				current_step++;
			}
			output.push({
				id: date_formatted,
				date: date_formatted,
				types: ["work"],
				workingHours: calc_hours,
			});
		}
		if (select_type !== "custom") {
			current_step = 0;
		}
	}
	await saveDays(output);
	await rerender();
}

// ok-neok Улучшенная функция расчета статистики
async function updateStats() {
	let total_work_hours = 0;
	let total_sick_hours = 0;
	let total_vacation_hours = 0;
	let work_days_count = 0;
	let sick_days_count = 0;
	let vacation_days_count = 0;

	for (let key in hash_saved_days) {
		const item = hash_saved_days[key];
		const hours = item?.workingHours || 0;
		const select_date = new Date(key);

		if (item.types.includes("work")) {
			work_days_count++;
			total_work_hours += hours;
		}
		if (item.types.includes("sick")) {
			sick_days_count++;
			if (!isWeekend(select_date) && !isHoliday(select_date)) {
				total_sick_hours += work_hours_per_day;
			}
		}
		if (item.types.includes("vacation")) {
			vacation_days_count++;
			if (!isWeekend(select_date) && !isHoliday(select_date)) {
				total_vacation_hours += work_hours_per_day;
			}
		}
	}

	const required_hours =
		MONTH_DATA.workingDays * work_hours_per_day - MONTH_DATA.shortDays;
	const balance_hours = Number(
		(
			total_work_hours +
			total_sick_hours +
			total_vacation_hours -
			required_hours
		).toFixed(2)
	);

	// Обновляем DOM
	document.getElementById("worked-hours").textContent =
		total_work_hours.toFixed(2);
	document.getElementById("required-hours").textContent =
		required_hours.toFixed(2);
	document.getElementById("balance-hours").textContent = balance_hours;
	document.getElementById("sick-days").textContent = sick_days_count;
	document.getElementById("sick-hours").textContent =
		total_sick_hours.toFixed(2);
	document.getElementById("vacation-days").textContent = vacation_days_count;
	document.getElementById("vacation-hours").textContent =
		total_vacation_hours.toFixed(2);

	const balanceStatusEl = document.getElementById("balance-status");
	if (balance_hours < 0) {
		balanceStatusEl.textContent = "Нехватка";
		balanceStatusEl.parentElement.className = "stat-card deficit";
	} else if (balance_hours > 0) {
		balanceStatusEl.textContent = "Переработка";
		balanceStatusEl.parentElement.className = "stat-card surplus";
	} else {
		balanceStatusEl.textContent = "Норма";
		balanceStatusEl.parentElement.className = "stat-card";
	}
}

// ok
function hideShowDataset(show) {
	const showHide = `data-${show ? "show" : "hide"}-if`;

	getValueElement = (el) => {
		switch (el.type) {
			case "checkbox":
				return String(el.checked);
			case "text":
			case "select-one":
				return el.value;
		}
		return null;
	};

	let stash = new Set();
	document.querySelectorAll(`[${showHide}]`).forEach((el) => {
		const condition = el.getAttribute(showHide);
		const [targetId, expectedValue] = condition.split("--");

		if (!targetId || !expectedValue) {
			console.warn(`Invalid ${showHide} format:`, condition);
			return;
		}
		const targetElement = document.getElementById(targetId);

		if (!targetElement) {
			console.warn("Target element not found:", targetId);
			return;
		}
		stash.add(targetId);
		const currentValue = getValueElement(targetElement);

		if (currentValue === expectedValue) {
			el.style.display = show ? "block" : "none";
		} else {
			el.style.display = show ? "none" : "block";
		}
	});

	stash.forEach((id) => {
		const targetElement = document.getElementById(id);

		targetElement.addEventListener("change", (event) => {
			let changed_els = document.querySelectorAll(
				`[${showHide}^=${id}--]`
			);
			changed_els.forEach((el) => {
				if (
					el.getAttribute(showHide).split("--")[1] ==
					getValueElement(event.target)
				) {
					el.style.display = show ? "block" : "none";
				} else {
					el.style.display = show ? "none" : "block";
				}
			});
		});
	});
}

// ok Функции для модального окна автозаполнения
function confirmAutoFill() {
	const workHours = parseFloat(
		document.getElementById("work-hours-per-day").value
	);

	if (workHours && workHours > 0) {
		clearCurrentMonth();
		performAutoFill();
		toggleleVisableElement(EL_AUTOFILL_MODAL);
	} else {
		alert("Пожалуйста, введите корректное количество часов");
	}
}

// ok Функции навигации
async function changeMonth(diff) {
	currentDate.setMonth(currentDate.getMonth() + diff);
	const newYear = currentDate.getFullYear();
	if (PRODUCTION_CALENDAR?.year !== newYear) {
		await loadCalendar(newYear);
	}
	await rerender();
}

// ok
async function goToToday() {
	const today = new Date();
	const todayYear = today.getFullYear();

	currentDate = today;

	if (PRODUCTION_CALENDAR?.year !== todayYear) {
		await loadCalendar(todayYear);
	}
	await rerender();
}

// ok Очистка месяца
async function clearCurrentMonth() {
	if (confirm("Вы уверены, что хотите очистить все данные за этот месяц?")) {
		const year = currentDate.getFullYear();
		const month = currentDate.getMonth();
		hash_saved_days = {};
		await clearMonth(year, month);
		await rerender();
	}
}

// ok
async function refreshCalendar() {
	EL_REFRESH_BUTTON.disabled = true;
	EL_REFRESH_BUTTON.textContent = "Обновление...";

	await refreshProductionCalendar(currentDate.getFullYear());

	EL_REFRESH_BUTTON.disabled = false;
	EL_REFRESH_BUTTON.textContent = "Обновить календарь";

	await rerender();
}

// ok-todo - прогнать загрузку
async function importData() {
	const isValidImportData = (data) => {
		return (
			typeof data === "object" &&
			data !== null &&
			"db_v" in data &&
			"db_name" in data &&
			"data" in data
		);
	};

	const file = await new Promise((resolve) => {
		const fileInput = createElement("LOAD_FILE", {}, "input");

		fileInput.addEventListener("change", (event) => {
			resolve(event.target.files[0]);
			document.body.removeChild(fileInput);
		});

		document.body.appendChild(fileInput);
		fileInput.click();
	});

	if (file) {
		let data_replaced = confirm(
			"Заменить существующие данные? (OK - заменить, Отмена - добавить)"
		);
		let parsedData;
		// todo
		try {
			const fileContent = await new Promise((resolve, reject) => {
				const reader = new FileReader();
				reader.onload = (e) => resolve(e.target.result);
				reader.onerror = (e) =>
					reject(new Error("Ошибка чтения файла"));
				reader.readAsText(file);
			});

			parsedData = JSON.parse(fileContent);

			if (!isValidImportData(parsedData)) {
				throw new Error("Неверная структура файла");
			}
		} catch (error) {
			console.error("Ошибка импорта:", error);
			alert(`Ошибка импорта: ${error.message}`);
			return;
		}

		if (data_replaced === "replace") {
			await clearAllDays();
		}

		// todo прогнать загрузку
		saveDaysFromImport(parsedData)
			.then((res) => console.log("TODO", res))
			.catch((err) => console.error("TODO TEST ERR", err));
	}
}

// ok Экспорт данных
async function exportData() {
	// Формируем данные для экспорта
	const export_data = await getAllDaysDB();

	// Создаем и скачиваем файл
	const data_str = JSON.stringify(export_data, null, 2);
	const data_blob = new Blob([data_str], { type: "application/json" });

	const link = document.createElement("a");
	link.href = URL.createObjectURL(data_blob);
	link.download = `dataset-calendar.json`;
	link.click();
}

// ok Вспомогательные функции для определения типа дня
function isWeekend(date) {
	const dayOfWeek = date.getDay();
	return dayOfWeek === 0 || dayOfWeek === 6;
}

// ok Проверка на праздник
function isHoliday(date) {
	if (PRODUCTION_CALENDAR?.year !== date.getFullYear()) {
		return false;
	}

	return PRODUCTION_CALENDAR.holidays?.[date.getMonth()]?.[date.getDate()];
}

// ок информация по праздницу
function getHolidayInfo(date) {
	if (PRODUCTION_CALENDAR?.year !== date.getFullYear()) {
		return false;
	}

	return PRODUCTION_CALENDAR.holidays?.[date.getMonth()]?.[date.getDate()];
}

// ok
async function setDaysForMonth() {
	console.log("ZZ", currentDate.getMonth());
	hash_saved_days = await getDaysForMonthDB(
		currentDate.getFullYear(),
		currentDate.getMonth()
	);
}

// ok
async function rerender() {
	setMonthData();
	await setDaysForMonth();
	await renderCalendar();
	await updateStats();

	if (context_menu_current_element) {
		const search_tag = context_menu_current_element.dataset.date;
		context_menu_current_element = EL_CALENDAR.querySelector(
			`[data-date="${search_tag}"]`
		);
		updateContextMenuState();
	}
}

// ok
async function loadCalendar(year) {
	toggleleVisableElement(EL_CALENDAR_LOADING);
	toggleleVisableElement(EL_CALENDAR);
	EL_CALENDAR_LOADING.textContent = "Загрузка производственного календаря...";
	try {
		PRODUCTION_CALENDAR = await loadProductionCalendar(year);
		toggleleVisableElement(EL_CALENDAR_LOADING);
		toggleleVisableElement(EL_CALENDAR);
	} catch (error) {
		console.error("Ошибка загрузки производственного календаря:", error);
		EL_CALENDAR_LOADING.innerHTML = `
			<div style='color: #e74c3c; text-align: center;'>
				<strong>${error.message}</strong>
			</div>
		`;
	}
}

// ok
async function renderCalendar() {
	const year = currentDate.getFullYear();
	const month = currentDate.getMonth();

	// Обновляем заголовок
	EL_CURRENT_MONTH.textContent = `${MONTHS[month]} ${year}`;

	// Очищаем календарь
	EL_CALENDAR.innerHTML = "";
	const fragment = document.createDocumentFragment();

	// Определяем первый и последний день месяца
	const firstDay = new Date(year, month, 1);
	const last_day = new Date(year, month + 1, 0);
	const days_in_month = last_day.getDate();

	// Определяем день недели первого дня месяца
	let first_day_week = firstDay.getDay();
	first_day_week = first_day_week === 0 ? 6 : first_day_week - 1;

	// Добавляем пустые ячейки
	for (let i = 0; i < first_day_week; i++) {
		const empty_day = createElement("EMPTY_DAY");
		fragment.appendChild(empty_day);
	}

	for (let day = 1; day <= days_in_month; day++) {
		const date = new Date(year, month, day);
		const date_formatted = formatDate(date);

		const saved_day = hash_saved_days[date_formatted];

		const day_el = createElement("FILL_DAY", { date: date });

		if (saved_day?.workingHours) {
			day_el
				.querySelector(".day-hours")
				.addEventListener("click", (e) => {
					e.stopPropagation();
					context_menu_current_element = day_el;
					showEditHoursModal();
				});
		}

		day_el.addEventListener("contextmenu", (e) => {
			context_menu_current_element = day_el;
			showContextMenu(e);
		});

		fragment.appendChild(day_el);
	}
	EL_CALENDAR.appendChild(fragment);
}

// ok Контекстное меню
function showContextMenu(e) {
	e.preventDefault();
	const x = e.clientX + window.scrollX;
	const y = e.clientY + window.scrollY;
	EL_CONTEXT_MENU.style.left = x + "px";
	EL_CONTEXT_MENU.style.top = y + "px";
	if (EL_CONTEXT_MENU.classList.contains("hide-element")) {
		toggleleVisableElement(EL_CONTEXT_MENU);
	}
	updateContextMenuState();
}

// ok
function floatToTime(hoursFloat) {
	const hours = Math.floor(hoursFloat);
	const minutes = Math.round((hoursFloat - hours) * 60);

	// Форматируем с лидирующими нулями
	const formattedHours = String(hours).padStart(2, "0");
	const formattedMinutes = String(minutes).padStart(2, "0");

	return `${formattedHours}:${formattedMinutes}`;
}

// ok
function timeToFloat(time) {
	if (time.includes(":")) {
		const [hours, minutes] = time.split(":").map(Number);
		return hours + minutes / 60;
	}

	return parseFloat(time);
}

// ok
function toggleleVisableElement(el, hold_stash = false) {
	if (!el.classList.contains("hide-element") && !hold_stash) {
		context_menu_current_element = null;
	}
	el.classList.toggle("hide-element");
}

// ok
function clearTimeField(e) {
	const target = e.target.dataset.acitonTime;
	document.getElementById(target).value = null;
}

// ok
function updateContextMenuState() {
	if (!context_menu_current_element) return;

	const current_types = getCurrentTypes(context_menu_current_element);
	EL_CONTEXT_MENU.querySelectorAll("[type=checkbox]").forEach((el) => {
		const has_class = current_types.includes(el.dataset.action);
		if (has_class != el.checked) {
			el.checked = has_class;
			el.dispatchEvent(new Event("change", { bubbles: true }));
		}
	});
}

// ok Вспомогательная функция для получения текущих типов
function getCurrentTypes(dayElement) {
	return Object.keys(TYPES_DAY).filter((class_name) =>
		dayElement.classList.contains(class_name)
	);
}

// ok
function hideModal(e) {
	toggleleVisableElement(e.target.parentNode);
}

// ok-vrode
async function handleContextMenuAction(action) {
	if (!context_menu_current_element) return;

	const date_formatted = formatDate(
		new Date(context_menu_current_element.dataset.date)
	);

	let work_time = null;

	switch (action) {
		case "work":
			if (!context_menu_current_element.classList.contains(action)) {
				work_time = work_hours_per_day;
			}
		case "sick":
		case "vacation":
			context_menu_current_element.classList.toggle(action);
			const add_tag =
				context_menu_current_element.classList.contains(action);
			// Получаем текущие типы
			await saveDays([
				{
					id: date_formatted,
					date: date_formatted,
					types: add_tag ? [action] : [],
					workingHours: work_time,
				},
			]);
			break;
		case "edit-hours":
			toggleleVisableElement(EL_CONTEXT_MENU, true);
			showEditHoursModal();
			break;
		case "clear":
			toggleleVisableElement(EL_CONTEXT_MENU);
			deleteDayByDate(date_formatted);
			break;
	}

	// Обновляем статистику и скрываем меню
	rerender();
}
