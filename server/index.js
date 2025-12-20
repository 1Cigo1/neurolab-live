const { Server } = require("socket.io");

const PORT = process.env.PORT || 3001;

const io = new Server(PORT, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

console.log(`🚀 Sunucu ${PORT} portunda aktif!`);

io.on("connection", (socket) => {
    console.log(`Bağlandı: ${socket.id}`);

    socket.on("join_room", (room) => {
        socket.join(room);
        console.log(`✅ ${socket.id} -> ${room} odasına girdi.`);
        
        // Odaya birinin girdiğini HERKESE duyur
        io.in(room).emit("user_joined_alert", { userId: socket.id });
        
        // Yeni gelen kişi için herkesten skorlarını tekrar istiyoruz
        socket.to(room).emit("request_leaderboard_update");
    });

    // --- SKOR TABLOSU ---
    socket.on("broadcast_loss", (data) => {
        // Skoru odadaki HERKESE (gönderen dahil) yayıyoruz ki liste senkron olsun
        io.in(data.room).emit("update_leaderboard", { 
            userId: data.userId, 
            loss: data.loss 
        });
    });

    // --- SOHBET (Fixlendi) ---
    socket.on("send_message", (data) => {
        console.log(`Mesaj: ${data.text}`);
        // Mesajı odadaki HERKESE gönder
        io.in(data.room).emit("receive_message", {
            userId: socket.id,
            text: data.text,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
    });

    // --- MOUSE (Fixlendi) ---
    socket.on("cursor_move", (data) => {
        // Mouse hareketini sadece DİĞERLERİNE yolla (kendin zaten görüyorsun)
        socket.to(data.room).emit("remote_cursor_move", { 
            userId: socket.id, 
            position: data.position 
        });
    });

    // --- SENKRONİZASYON ---
    socket.on("sync_architecture", (data) => socket.to(data.room).emit("sync_architecture", data.architecture));
    socket.on("sync_dead_neurons", (data) => socket.to(data.room).emit("sync_dead_neurons", data.deadNeurons));
    socket.on("sync_training_start", (room) => socket.to(room).emit("sync_training_start"));

    socket.on("disconnecting", () => {
        const rooms = [...socket.rooms];
        rooms.forEach((room) => {
            io.in(room).emit("user_left", { userId: socket.id });
        });
    });
});

io.listen(PORT);