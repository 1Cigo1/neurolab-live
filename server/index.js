const { Server } = require("socket.io");

// Port ayarı: Render'ın verdiği portu kullan yoksa 3001
const PORT = process.env.PORT || 3001;

const io = new Server(PORT, {
  cors: {
    origin: "*",
  }
});

console.log(`🚀 Backend Sunucusu ${PORT} portunda çalışıyor...`);

io.on("connection", (socket) => {
    // ... (Senin mevcut kodların buraya aynen gelecek) ...
    // Buradaki kodları silme, aynen kalsın.
    console.log(`Bağlantı: ${socket.id}`);
    
    socket.on("join_room", (room) => {
        socket.join(room);
    });

    socket.on("sync_architecture", (data) => {
        const { room, architecture } = data;
        socket.to(room).emit("sync_architecture", architecture);
    });

    socket.on("sync_training_start", (room) => {
        socket.to(room).emit("sync_training_start");
    });
});