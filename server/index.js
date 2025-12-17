const { Server } = require("socket.io");

const PORT = process.env.PORT || 3001;

const io = new Server(PORT, {
  cors: {
    origin: "*",
  }
});

console.log(`🚀 Backend Sunucusu ${PORT} portunda çalışıyor...`);

io.on("connection", (socket) => {
    console.log(`Yeni Bağlantı: ${socket.id}`);
    
    // Odaya katılma isteği
    socket.on("join_room", (room) => {
        socket.join(room);
        console.log(`Kullanıcı ${socket.id}, ${room} odasına katıldı.`);
        
        // ÖNEMLİ: Odaya yeni biri girince, odadaki ESKİ kişilere haber ver
        // Böylece eski kişiler, ellerindeki güncel veriyi yeni gelene gönderebilir.
        socket.to(room).emit("user_joined");
    });

    // Mimariyi (katmanları) eşitleme
    socket.on("sync_architecture", (data) => {
        const { room, architecture } = data;
        // Gönderen hariç odadaki herkese yolla
        socket.to(room).emit("sync_architecture", architecture);
    });

    // Eğitimi eşitleme
    socket.on("sync_training_start", (room) => {
        socket.to(room).emit("sync_training_start");
    });

    // Sabotaj (Ölü nöron) eşitleme
    socket.on("sync_dead_neurons", (data) => {
        const { room, deadNeurons } = data;
        socket.to(room).emit("sync_dead_neurons", deadNeurons);
    });
});

io.listen(PORT);