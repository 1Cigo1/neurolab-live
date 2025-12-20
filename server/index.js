const { Server } = require("socket.io");

const PORT = process.env.PORT || 3001;

const io = new Server(PORT, {
  cors: {
    origin: "*", // Tüm dünyadan gelen bağlantıları kabul et
    methods: ["GET", "POST"], // Veri alışverişine izin ver
    allowedHeaders: ["my-custom-header"],
    credentials: true
  }
});

console.log(`🚀 Backend Sunucusu ${PORT} portunda çalışıyor...`);

io.on("connection", (socket) => {
    console.log(`✅ YENİ KULLANICI BAĞLANDI: ${socket.id}`);
    
    socket.on("join_room", (room) => {
        socket.join(room);
        console.log(`🏠 ${socket.id} -> ${room} odasına girdi.`);
        
        // Odadakilere haber ver
        socket.to(room).emit("user_joined");
        socket.to(room).emit("request_leaderboard_update");
    });

    // --- SENKRONİZASYON ---
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
        socket.to(data.room).emit("update_leaderboard", { 
            userId: data.userId, 
            loss: data.loss 
        });
    });

    // --- MOUSE VE SOHBET ---
    socket.on("cursor_move", (data) => {
        // Mouse hareketini sunucu konsoluna yazdırma (çok hızlı akar)
        socket.to(data.room).emit("remote_cursor_move", { 
            userId: socket.id, 
            position: data.position 
        });
    });

    socket.on("send_message", (data) => {
        console.log(`💬 Mesaj (${data.room}): ${data.text}`);
        io.in(data.room).emit("receive_message", {
            userId: socket.id,
            text: data.text,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
    });

    socket.on("disconnecting", () => {
        console.log(`❌ KULLANICI AYRILIYOR: ${socket.id}`);
        const rooms = [...socket.rooms];
        rooms.forEach((room) => {
            socket.to(room).emit("user_left", { userId: socket.id });
        });
    });
});

io.listen(PORT);