<x-layouts.studio>
    <section class="login-panel">
        <div class="eyebrow">BIENVENUE DANS TON ATELIER</div>
        <h1>Les belles histoires<br>commencent ici.</h1>
        <p class="muted">Connecte-toi pour retrouver tes épisodes et écrire la suite.</p>
        <form method="post" action="{{ route('login') }}" class="stack">
            @csrf
            <label>Adresse e-mail<input type="email" name="email" value="{{ old('email') }}" autocomplete="username" required autofocus></label>
            <label>Mot de passe<input type="password" name="password" autocomplete="current-password" required></label>
            @error('email')<p class="error">{{ $message }}</p>@enderror
            @error('password')<p class="error">{{ $message }}</p>@enderror
            <label class="check"><input type="checkbox" name="remember" value="1"> Se souvenir de moi</label>
            <button class="button primary">Entrer dans le studio</button>
        </form>
        <p class="muted">Accès réservé aux administrateurs.</p>
    </section>
</x-layouts.studio>
