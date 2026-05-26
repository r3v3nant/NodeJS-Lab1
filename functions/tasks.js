const { ObjectId } = require("mongodb");
const connectDB = require("./db");

// Універсальні заголовки для уникнення проблем з CORS
const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
};

exports.handler = async (event) => {
    // Обробка попередніх запитів браузера (CORS Preflight)
    if (event.httpMethod === "OPTIONS") {
        return { statusCode: 200, headers: CORS_HEADERS, body: "" };
    }

    try {
        const collection = await connectDB();
        const id = event.queryStringParameters ? event.queryStringParameters.id : null;

        switch (event.httpMethod) {

            // ==========================================
            // GET: Отримання одного або списку елементів
            // ==========================================
            case "GET":
                if (id) {
                    // GET /tasks?id={id} — Деталі конкретного завдання
                    const task = await collection.findOne({ _id: new ObjectId(id) });
                    if (!task) {
                        return { statusCode: 404, headers: CORS_HEADERS, body: JSON.stringify({ error: "Task not found" }) };
                    }
                    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(task) };
                } else {
                    // GET /tasks — Повний список із фільтрацією, сортуванням та пагінацією
                    const { search, sortField, sortOrder = "asc", skip, take } = event.queryStringParameters || {};

                    const query = search ? { title: new RegExp(search, "i") } : {};
                    const sort = sortField ? { [sortField]: sortOrder === "desc" ? -1 : 1 } : {};
                    const skipValue = Number.isInteger(parseInt(skip)) ? parseInt(skip) : 0;
                    const takeValue = Number.isInteger(parseInt(take)) ? parseInt(take) : 20;

                    const tasks = await collection.find(query).sort(sort).skip(skipValue).limit(takeValue).toArray();
                    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(tasks) };
                }

            // ==========================================
            // POST: Створення нового елемента
            // ==========================================
            case "POST":
                if (!event.body) {
                    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "Missing body data" }) };
                }
                const newData = JSON.parse(event.body);
                if (!newData.title) {
                    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "Title is required" }) };
                }
                const newDoc = {
                    title: newData.title,
                    description: newData.description || "",
                    completed: false,
                    createdAt: new Date()
                };
                const insertResult = await collection.insertOne(newDoc);
                return {
                    statusCode: 201,
                    headers: CORS_HEADERS,
                    body: JSON.stringify({ message: "Created successfully", id: insertResult.insertedId })
                };

            // ==========================================
            // PUT: Оновлення існуючого елемента
            // ==========================================
            case "PUT":
                if (!id) {
                    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "Task ID query parameter is required" }) };
                }
                if (!event.body) {
                    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "Missing body data" }) };
                }
                const updateData = JSON.parse(event.body);
                const updateResult = await collection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: updateData }
                );
                if (updateResult.matchedCount === 0) {
                    return { statusCode: 404, headers: CORS_HEADERS, body: JSON.stringify({ error: "Task not found" }) };
                }
                return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ message: "Updated successfully" }) };

            // ==========================================
            // DELETE: Видалення елемента
            // ==========================================
            case "DELETE":
                if (!id) {
                    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "Task ID query parameter is required" }) };
                }
                const deleteResult = await collection.deleteOne({ _id: new ObjectId(id) });
                if (deleteResult.deletedCount === 0) {
                    return { statusCode: 404, headers: CORS_HEADERS, body: JSON.stringify({ error: "Task not found" }) };
                }
                return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ message: "Deleted successfully" }) };

            default:
                return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: "Method Not Allowed" }) };
        }
    } catch (error) {
        console.error("ПОМИЛКА БЕКЕНДУ:", error);
        return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: error.message }) };
    }
};
