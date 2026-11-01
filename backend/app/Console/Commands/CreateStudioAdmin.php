<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;

class CreateStudioAdmin extends Command
{
    protected $signature = 'studio:admin {email} {--name=Administrateur}';

    protected $description = 'Créer un administrateur du studio (mot de passe demandé sans affichage)';

    public function handle(): int
    {
        $password = $this->secret('Mot de passe (12 caractères minimum)');
        $values = ['email' => $this->argument('email'), 'password' => $password, 'name' => $this->option('name')];
        $validator = Validator::make($values, [
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:12',
            'name' => 'required|string|max:255',
        ]);
        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $error) {
                $this->error($error);
            }

            return self::FAILURE;
        }
        $user = new User($values);
        $user->is_admin = true;
        $user->save();
        $this->info('Administrateur créé.');

        return self::SUCCESS;
    }
}
