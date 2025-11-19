const DB_NAME = "WorkCalendarDB";
const DB_VERSION = 1; // Увеличиваем версию для добавления нового хранилища
const DAYS_STORE_NAME = "days";
const CALENDAR_STORE_NAME = "production_calendars"; // Новое хранилище для календарей

//ok Инициализация IndexedDB
async function initDB() {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);

		request.onerror = () => reject(request.error);
		request.onsuccess = () => {
			db = request.result;
			resolve(db);
		};

		request.onupgradeneeded = (event) => {
			const db = event.target.result;

			// Создаем хранилище для дней, если его нет
			if (!db.objectStoreNames.contains(DAYS_STORE_NAME)) {
				const store = db.createObjectStore(DAYS_STORE_NAME, {
					keyPath: "id",
				});
				store.createIndex("date", "date", { unique: false });
			}

			// Создаем хранилище для производственных календарей
			if (!db.objectStoreNames.contains(CALENDAR_STORE_NAME)) {
				const calendarStore = db.createObjectStore(
					CALENDAR_STORE_NAME,
					{
						keyPath: "year",
					}
				);
				calendarStore.createIndex("year", "year", { unique: true });
			}
		};
	});
}

// ok-neok Загрузка производственного календаря
async function loadProductionCalendar(year) {
	let calendar = await getProductionCalendar(year);

	if (calendar) {
		return calendar;
	}

	const [calendarResponse, holidaysResponse] = await Promise.all([
		fetch(`https://calendar.kuzyak.in/api/calendar/${year}`),
		fetch(`https://calendar.kuzyak.in/api/calendar/${year}/holidays`),
	]);

	if (!calendarResponse.ok) {
		const errorData = await calendarResponse.json().catch(() => null);
		if (errorData && calendarResponse.status == 422) {
			throw new Error(
				`Производственный календарь на ${year} год еще не доступен`,
				{ cause: "PRODUCTION_CALENDAR_NOT_AVAILABLE" }
			);
		}
		throw new Error(`HTTP Error: ${calendarResponse.status}`);
	}

	const calendarData = await calendarResponse.json();

	let holidaysData = { holidays: [] };
	if (!holidaysResponse.ok) {
		const errorData = await calendarResponse.json().catch(() => null);
		if (errorData && calendarResponse.status == 422) {
			throw new Error(`Праздничные дни на ${year} год еще не доступны`, {
				cause: "HOLIDAYS_NOT_AVAILABLE",
			});
		}
		throw new Error(`HTTP Error: ${holidaysResponse.status}`);
	}

	holidaysData = await holidaysResponse.json();
	let holidays_hash = {};
	for (let item of holidaysData.holidays) {
		let holiday_date = new Date(item.date);
		let month = holiday_date.getMonth();
		holidays_hash[month] ??= {};
		holidays_hash[month][holiday_date.getDate()] = item.name;
	}

	// Объединяем данные
	const combinedData = {
		...calendarData,
		holidays: holidays_hash,
	};

	// Сохраняем в базу данных для будущего использования
	await saveProductionCalendar(combinedData);

	console.log("Объединенный календарь загружен и сохранен:", combinedData);
	return combinedData;
}

//ok Сохранение производственного календаря в IndexedDB
async function saveProductionCalendar(calendarData) {
	return new Promise((resolve, reject) => {
		const transaction = db.transaction([CALENDAR_STORE_NAME], "readwrite");
		const store = transaction.objectStore(CALENDAR_STORE_NAME);
		const request = store.put({
			year: calendarData.year,
			data: calendarData,
			lastUpdated: new Date().toISOString(),
		});

		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve(request.result);
	});
}

//ok Получение производственного календаря из IndexedDB
async function getProductionCalendar(year) {
	return new Promise((resolve, reject) => {
		const transaction = db.transaction([CALENDAR_STORE_NAME], "readonly");
		const store = transaction.objectStore(CALENDAR_STORE_NAME);
		const request = store.get(year);

		request.onerror = () => reject(request.error);
		request.onsuccess = () => {
			const result = request.result;
			resolve(result ? result.data : null);
		};
	});
}

//ok Функция для принудительного обновления календаря (например, при смене года)
async function refreshProductionCalendar(year) {
	try {
		// Удаляем старый календарь из базы
		const transaction = db.transaction([CALENDAR_STORE_NAME], "readwrite");
		const store = transaction.objectStore(CALENDAR_STORE_NAME);
		await store.delete(year);

		// Загружаем заново
		await loadProductionCalendar(year);
	} catch (error) {
		console.error("Ошибка при обновлении календаря:", error);
	}
}

// ok Получение всех дней за месяц
async function getDaysForMonthDB(year, month) {
	return new Promise((resolve, reject) => {
		const startDate = formatDate(new Date(year, month, 1));
		const endDate = formatDate(new Date(year, month + 1, 0));

		const transaction = db.transaction([DAYS_STORE_NAME], "readonly");
		const store = transaction.objectStore(DAYS_STORE_NAME);
		const index = store.index("date");
		const range = IDBKeyRange.bound(startDate, endDate);

		const request = index.getAll(range);

		request.onerror = () => reject(request.error);
		request.onsuccess = () => {
			const daysMap = {};
			request.result.forEach((day) => {
				daysMap[day.date] = day;
			});
			resolve(daysMap);
		};
	});
}

async function getAllDaysDB() {
	return new Promise((resolve, reject) => {
		const transaction = db.transaction([DAYS_STORE_NAME], "readonly");
		const store = transaction.objectStore(DAYS_STORE_NAME);
		const index = store.index("date");
		const request = index.getAll();

		request.onerror = () => reject(request.error);
		request.onsuccess = () => {
			const daysMap = [];
			request.result.forEach((day) => {
				daysMap.push(day);
			});
			resolve({ db_v: DB_VERSION, db_name: DB_NAME, data: daysMap });
		};
	});
}

async function saveDaysFromImport(parsedData) {
	return new Promise((resolve, reject) => {
		if (parsedData.db_name != DB_NAME)
			reject(new Error("Данные не для этой базы"));
		if (parsedData.db_v != DB_VERSION)
			reject(new Error("Версия базы не соответствует")); // тут нужна будет миграция, если буду обновлять приложуху

		saveDays.then((res) => resolve(res)).catch((err) => reject(err));
	});
}

async function clearAllDays() {
	return new Promise((resolve, reject) => {
		const transaction = db.transaction([DAYS_STORE_NAME], "readwrite");
		const store = transaction.objectStore(DAYS_STORE_NAME);
		const index = store.index("date");

		const request = index.openCursor();

		request.onerror = () => reject(request.error);
		request.onsuccess = (event) => {
			const cursor = event.target.result;
			if (cursor) {
				cursor.delete();
				cursor.continue();
			} else {
				resolve();
			}
		};
	});
}

async function clearMonth(year, month) {
	return new Promise((resolve, reject) => {
		const startDate = new Date(year, month, 1);
		const endDate = new Date(year, month + 1, 0);

		const transaction = db.transaction([DAYS_STORE_NAME], "readwrite");
		const store = transaction.objectStore(DAYS_STORE_NAME);
		const index = store.index("date");
		const range = IDBKeyRange.bound(
			formatDate(startDate),
			formatDate(endDate)
		);

		const request = index.openCursor(range);

		request.onerror = () => reject(request.error);
		request.onsuccess = (event) => {
			const cursor = event.target.result;
			if (cursor) {
				cursor.delete();
				cursor.continue();
			} else {
				resolve();
			}
		};
	});
}

async function saveDays(days) {
	return new Promise((resolve, reject) => {
		const transaction = db.transaction([DAYS_STORE_NAME], "readwrite");
		const store = transaction.objectStore(DAYS_STORE_NAME);

		let errorCount = 0;
		transaction.oncomplete = () => {
			resolve({
				imported: days.length - errorCount,
				errors: errorCount,
			});
		};

		transaction.onerror = (event) => {
			reject(new Error(`Transaction error: ${event.target.error}`));
		};

		days.forEach((dayData) => {
			const request = store.put(dayData);
			request.onerror = () => errorCount++;
		});
	});
}

async function deleteWorkByDate(date) {
	return new Promise((resolve, reject) => {
		const transaction = db.transaction([DAYS_STORE_NAME], "readwrite");
		const store = transaction.objectStore(DAYS_STORE_NAME);

		const request = store.delete(date);

		request.onsuccess = () => {
			resolve(true);
		};

		request.onerror = () => {
			reject(request.error);
		};
	});
}

async function deleteDayByDate(date) {
	return new Promise((resolve, reject) => {
		const transaction = db.transaction([DAYS_STORE_NAME], "readwrite");
		const store = transaction.objectStore(DAYS_STORE_NAME);

		const request = store.delete(date);

		request.onsuccess = () => {
			resolve(true);
		};

		request.onerror = () => {
			reject(request.error);
		};
	});
}

async function resetWorkData(date) {
	return new Promise((resolve, reject) => {
		const transaction = db.transaction([DAYS_STORE_NAME], "readwrite");
		const store = transaction.objectStore(DAYS_STORE_NAME);

		// 1. Получаем текущую запись
		const getRequest = store.get(date);

		getRequest.onsuccess = () => {
			const dayData = getRequest.result;
			if (!dayData) {
				reject(new Error(`Запись с датой ${date} не найдена`));
				return;
			}

			const updatedData = { ...dayData };

			if (Array.isArray(updatedData.types)) {
				updatedData.types = updatedData.types.filter(
					(type) => type !== "work"
				);
			}

			if ("workingHours" in updatedData) {
				delete updatedData.workingHours;
			}

			const putRequest = store.put(updatedData);

			putRequest.onsuccess = () => {
				console.log(`Данные работы удалены из записи ${date}`);
				resolve(updatedData);
			};

			putRequest.onerror = () => reject(putRequest.error);
		};

		getRequest.onerror = () => reject(getRequest.error);
	});
}
