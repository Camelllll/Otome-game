<?php

use App\Models\MediaAsset;

return [
    'temporary_file_upload' => [
        'rules' => ['required', 'file', 'max:'.MediaAsset::MAX_UPLOAD_KB],
        'max_upload_time' => 10,
    ],
];
