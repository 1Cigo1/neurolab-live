const { Server } = require("socket.io");

const PORT = process.env.PORT || 3001;

const io = new Server(PORT, {
  cors: {
    origin: "*", // Her yerden bağlantıya izin ver
  }
});

console.log(`🚀 Backend Sunucusu ${PORT} portunda çalışıyor...`);

io.on("connection", (socket) => {
    console.log(`Yeni Bağlantı: ${socket.id}`);
    
    // --- ODAYA KATILMA ---
    socket.on("join_room", (room) => {
        socket.join(room);
        console.log(`Kullanıcı ${socket.id}, ${room} odasına katıldı.`);
        
        // 1. Odadakilere "Biri geldi" de
        socket.to(room).emit("user_joined");

        // 2. YENİ EKLENEN KISIM: Odadaki herkesten skorlarını tekrar istiyoruz
        // Böylece yeni gelen kişi boş liste görmeyecek.
        socket.to(room).emit("request_leaderboard_update");
    });

    // --- MİMARİ VE EĞİTİM SENKRONİZASYONU ---
    socket.on("sync_architecture", (data) => {
        // Gönderen hariç diğerlerine yolla
        socket.to(data.room).emit("sync_architecture", data.architecture);
    });

    socket.on("sync_training_start", (room) => {
        socket.to(room).emit("sync_training_start");
    });

    socket.on("sync_dead_neurons", (data) => {
        socket.to(data.room).emit("sync_dead_neurons", data.deadNeurons);
    });

    // --- SKOR TABLOSU (LİDERLİK) ---
    socket.on("broadcast_loss", (data) => {
        // Herkesin skorunu diğerlerine yay
        socket.to(data.room).emit("update_leaderboard", { 
            userId: data.userId, 
            loss: data.loss 
        });
    });

    // --- METAVERSE ÖZELLİKLERİ (İmleç & Sohbet) ---

    // 1. MOUSE HAREKETİ
    socket.on("cursor_move", (data) => {
        socket.to(data.room).emit("remote_cursor_move", { 
            userId: socket.id, 
            position: data.position 
        });
    });

    // 2. SOHBET MESAJI
    socket.on("send_message", (data) => {
        // Mesajı odaya (gönderen dahil herkes) yay
        io.in(data.room).emit("receive_message", {
            userId: socket.id,
            text: data.text,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
    });

    // --- BAĞLANTI KOPMA ---
    socket.on("disconnecting", () => {
        const rooms = [...socket.rooms];
        rooms.forEach((room) => {
            // Odadakilere "Bu kişi çıktı, imlecini sil" de
            socket.to(room).emit("user_left", { userId: socket.id });
        });
    });
});

io.listen(PORT);