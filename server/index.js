const { Server } = require("socket.io");

const PORT = process.env.PORT || 3001;

const io = new Server(PORT, {
  cors: {
    origin: "*",
  }
});

console.log(`🚀 Backend Sunucusu ${PORT} portunda çalışıyor...`);

io.on("connection", (socket) => {
    // --- MEVCUT KODLAR ---
    socket.on("join_room", (room) => {
        socket.join(room);
        socket.to(room).emit("user_joined");
    });

    socket.on("sync_architecture", (data) => {
        socket.to(data.room).emit("sync_architecture", data.architecture);
    });

    socket.on("sync_training_start", (room) => {
        socket.to(room).emit("sync_training_start");
    });

    socket.on("sync_dead_neurons", (data) => {
        socket.to(data.room).emit("sync_dead_neurons", data.deadNeurons);
    });

    socket.on("broadcast_loss", (data) => {
        socket.to(data.room).emit("update_leaderboard", { userId: data.userId, loss: data.loss });
    });

    // --- YENİ EKLENENLER (ETKİLEŞİM) ---

    // 1. MOUSE HAREKETİ (Hafif olması için sadece koordinat yollar)
    socket.on("cursor_move", (data) => {
        // Gönderen hariç herkese yolla
        socket.to(data.room).emit("remote_cursor_move", { 
            userId: socket.id, 
            position: data.position 
        });
    });

    // 2. SOHBET MESAJI
    socket.on("send_message", (data) => {
        io.in(data.room).emit("receive_message", {
            userId: socket.id,
            text: data.text,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
    });

    // Kullanıcı çıkarsa imleci silmek için haber ver
    socket.on("disconnecting", () => {
        const rooms = [...socket.rooms];
        rooms.forEach((room) => {
            socket.to(room).emit("user_left", { userId: socket.id });
        });
    });
});

io.listen(PORT);