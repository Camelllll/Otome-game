<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class AccountController extends Controller
{
    private function player(User $user): array
    {
        return ['pseudo' => $user->name, 'email' => $user->email];
    }

    public function show(Request $request): JsonResponse
    {
        return response()->json(['player' => $this->player($request->user())])
            ->header('Cache-Control', 'private, no-store');
    }

    public function update(Request $request): JsonResponse
    {
        $user = $request->user();
        if (is_string($request->input('pseudo'))) {
            $request->merge(['pseudo' => trim($request->input('pseudo'))]);
        }
        $data = $request->validate([
            'current_password' => ['bail', 'required', 'string', 'max:100', 'current_password:sanctum'],
            'email' => ['sometimes', 'required', 'string', 'email:rfc', 'max:100', Rule::unique('users', 'email')->ignore($user->id)],
            'pseudo' => ['sometimes', 'required', 'string', 'min:3', 'max:40', 'regex:/^[\pL\pM\pN _-]+$/u'],
            'password' => ['sometimes', 'required', 'string', 'min:8', 'max:100', 'confirmed', 'different:current_password'],
        ], [
            'current_password.required' => 'Saisis ton mot de passe actuel.',
            'current_password.string' => 'Le mot de passe actuel est invalide.',
            'current_password.current_password' => 'Le mot de passe actuel est incorrect.',
            'email.email' => 'L’adresse e-mail n’est pas valide.',
            'email.unique' => 'Cette adresse e-mail est déjà utilisée.',
            'pseudo.min' => 'Le pseudo doit contenir au moins 3 caractères.',
            'pseudo.max' => 'Le pseudo ne doit pas dépasser 40 caractères.',
            'pseudo.regex' => 'Le pseudo peut contenir des lettres, chiffres, espaces, tirets et traits de soulignement.',
            'password.min' => 'Le nouveau mot de passe doit contenir au moins 8 caractères.',
            'password.max' => 'Le nouveau mot de passe ne doit pas dépasser 100 caractères.',
            'password.confirmed' => 'Les nouveaux mots de passe doivent être identiques.',
            'password.different' => 'Choisis un mot de passe différent du mot de passe actuel.',
        ]);
        DB::transaction(function () use ($user, $data) {
            if (isset($data['email']) && $data['email'] !== $user->email) {
                $user->email = $data['email'];
                $user->email_verified_at = null;
            }
            if (isset($data['pseudo'])) {
                $user->name = $data['pseudo'];
            }
            if (isset($data['password'])) {
                $user->password = $data['password'];
            }
            $user->save();
            if (isset($data['password']) || isset($data['email'])) {
                $user->tokens()->whereKeyNot($user->currentAccessToken()->id)->delete();
                DB::table('sessions')->where('user_id', $user->id)->delete();
                $user->setRememberToken(null);
                $user->save();
            }
        });

        return response()->json(['player' => $this->player($user)])
            ->header('Cache-Control', 'private, no-store');
    }

    public function destroy(Request $request): JsonResponse
    {
        $request->validate([
            'current_password' => ['bail', 'required', 'string', 'max:100', 'current_password:sanctum'],
            'confirmation' => ['required', 'in:SUPPRIMER'],
        ], [
            'current_password.required' => 'Saisis ton mot de passe actuel.',
            'current_password.current_password' => 'Le mot de passe actuel est incorrect.',
            'confirmation.required' => 'Saisis SUPPRIMER pour confirmer.',
            'confirmation.in' => 'Saisis exactement SUPPRIMER pour confirmer.',
        ]);
        $user = $request->user();
        DB::transaction(function () use ($user) {
            $user->tokens()->delete();
            DB::table('sessions')->where('user_id', $user->id)->delete();
            // Les sauvegardes, choix et illustrations utilisent ON DELETE CASCADE.
            $user->delete();
        });

        return response()->json(['ok' => true]);
    }
}
