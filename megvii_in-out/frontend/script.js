const daySection = document.getElementById("day-section");
const summarySection = document.getElementById("summary-section");
const toggleViewButton = document.getElementById("toggle-view");
const backButton = document.getElementById("back-button");
const dayBody = document.getElementById("day-body");
const summaryBody = document.getElementById("summary-body");

let activeView = "day";

function renderEmptyRow(target, message, colSpan) {
    target.innerHTML = `<tr class="empty-row"><td colspan="${colSpan}">${message}</td></tr>`;
}

function toInt(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function formatDate(dateText) {
    if (!dateText) {
        return "";
    }

    const parts = String(dateText).split("-");
    if (parts.length !== 3) {
        return String(dateText);
    }

    const [yyyy, mm, dd] = parts;
    return `${dd}/${mm}/${yyyy}`;
}

async function fetchDay() {
    try {
        const response = await fetch("/api/day", { cache: "no-store" });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const rows = await response.json();
        if (!Array.isArray(rows) || rows.length === 0) {
            renderEmptyRow(dayBody, "Khong co du lieu", 3);
            return;
        }

        dayBody.innerHTML = rows.map((item) => {
            const name = item.name ?? "";
            const inValue = toInt(item.in);
            const outValue = toInt(item.out);
            return `
                <tr>
                    <td>${name}</td>
                    <td>${inValue}</td>
                    <td>${outValue}</td>
                </tr>
            `;
        }).join("");
    } catch (error) {
        console.error("Fetch /day failed", error);
        renderEmptyRow(dayBody, "Loi tai du lieu", 3);
    }
}

async function fetchSummary() {
    try {
        const response = await fetch("/api/summary", { cache: "no-store" });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const rows = await response.json();
        if (!Array.isArray(rows) || rows.length === 0) {
            renderEmptyRow(summaryBody, "Khong co du lieu", 3);
            return;
        }

        summaryBody.innerHTML = rows.map((item) => {
            const date = formatDate(item.date);
            const inTotal = toInt(item.in_total);
            const outTotal = toInt(item.out_total);
            return `
                <tr>
                    <td>${date}</td>
                    <td>${inTotal}</td>
                    <td>${outTotal}</td>
                </tr>
            `;
        }).join("");
    } catch (error) {
        console.error("Fetch /summary failed", error);
        renderEmptyRow(summaryBody, "Loi tai du lieu", 3);
    }
}

function showDay() {
    activeView = "day";
    daySection.classList.remove("hidden");
    summarySection.classList.add("hidden");
    toggleViewButton.classList.remove("hidden");
}

function showSummary() {
    activeView = "summary";
    summarySection.classList.remove("hidden");
    daySection.classList.add("hidden");
    toggleViewButton.classList.add("hidden");
}

toggleViewButton.addEventListener("click", async () => {
    showSummary();
    await fetchSummary();
});

backButton.addEventListener("click", async () => {
    showDay();
    await fetchDay();
});

setInterval(() => {
    if (activeView === "day") {
        fetchDay();
    } else {
        fetchSummary();
    }
}, 5000);

fetchDay();
