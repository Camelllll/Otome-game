<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'string', 'email:rfc', 'max:100', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'max:100'],
            'pseudo' => ['nullable', 'string', 'max:40'],
        ]);

        $pseudo = trim((string) ($data['pseudo'] ?? ''));
        $user = User::create([
            'name' => $pseudo !== '' ? $pseudo : 'Sucrette',
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
        ]);

        return $this->issueToken($user, 201);
    }

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'string', 'max:100'],
            'password' => ['required', 'string', 'max:100'],
        ]);

        $user = User::query()->where('email', $data['email'])->first();
        if ($user === null || ! Hash::check($data['password'], $user->password)) {
            return response()->json(['message' => 'Identifiants incorrects.'], 401);
        }

        return $this->issueToken($user);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json(['player' => $this->player($request->user())]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['ok' => true]);
    }

    private function issueToken(User $user, int $status = 200): JsonResponse
    {
        $token = $user->createToken('jeu', ['*'], now()->addDays(30));

        return response()->json([
            'token' => $token->plainTextToken,
            'player' => $this->player($user),
        ], $status);
    }

    private function player(User $user): array
    {
        return ['id' => $user->id, 'pseudo' => $user->name];
    }
}