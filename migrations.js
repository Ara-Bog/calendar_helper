function migrateFrom0To1(database, transaction) {
	const store = database.createObjectStore(DAYS_STORE_NAME, {
		keyPath: "id",
		autoIncrement: true,
	});

	store.createIndex("date", "date", { unique: false });

	const calendarStore = database.createObjectStore(CALENDAR_STORE_NAME, {
		keyPath: "year",
	});
	calendarStore.createIndex("year", "year", { unique: true });
	console.log("Created initial database structure (v1)");
}

function migrateFrom1To2(database, transaction) {
	const store = transaction.objectStore(DAYS_STORE_NAME);

	const request = store.openCursor();

	request.onsuccess = (event) => {
		const cursor = event.target.result;

		if (cursor) {
			const record = cursor.value;

			if (record.lock === undefined) {
				record.lock = false;

				cursor.update(record);
			}

			cursor.continue();
		}
	};

	request.onerror = (event) => {
		console.error("Migration error:", event.target.error);
	};
}
